document.addEventListener('DOMContentLoaded', function () {
    let bgFadeDuration = 2000; // Fade in/out duration in milliseconds
    let bgDynamicVolume = -3;  // Volume in dB when no other tracks are playing
    let backgroundVolume = -12; // Initial background volume in dB

    // Global variables
    let isPlaying = false;
    let backgroundTrack = null;
    let trackPlayers = {}; // To keep track of all playing tracks
    let playingSquares = [];
    let dotX, dotY;
    let blueSquares = [];
    let p5Instance;
    let tracksVolume = -24; // Initial tracks volume in dB

    // Get the container element
    let container = document.getElementById('canvasContainer');
    container.style.position = 'relative';

    // Create the display element
    let latLonDisplay = document.createElement('div');
    latLonDisplay.id = 'latLonDisplay';
    latLonDisplay.style.fontSize = '36px';
    latLonDisplay.style.fontFamily = 'Arial';
    latLonDisplay.style.marginBottom = '0px';
    latLonDisplay.style.color = '#596a7b';
    latLonDisplay.style.textAlign = 'center';
    latLonDisplay.style.display = 'flex';
    latLonDisplay.style.flexDirection = 'column';  
    latLonDisplay.style.margin = '180px auto 0 auto';

    // Insert it before the canvasContainer
    container.parentNode.insertBefore(latLonDisplay, container.nextSibling);

    function getTracks() {
        let currentLanguage = localStorage.getItem('appLanguage') || 'english';
        let currentPage = document.body.dataset.page; // 'testing'
        return languageData[currentLanguage][currentPage].audio.tracks;
    }

    // Volume sliders
    let backgroundVolumeSlider = document.getElementById('backgroundVolume');
    let tracksVolumeSlider = document.getElementById('tracksVolume');

    // Create volume display labels
    let backgroundVolumeDisplay = document.createElement('span');
    backgroundVolumeDisplay.id = 'backgroundVolumeDisplay';
    backgroundVolumeDisplay.style.marginLeft = '10px';
    backgroundVolumeSlider.parentNode.appendChild(backgroundVolumeDisplay);

    let tracksVolumeDisplay = document.createElement('span');
    tracksVolumeDisplay.id = 'tracksVolumeDisplay';
    tracksVolumeDisplay.style.marginLeft = '10px';
    tracksVolumeSlider.parentNode.appendChild(tracksVolumeDisplay);

    // Update volume displays
    backgroundVolumeDisplay.textContent = `${backgroundVolume} dB`;
    tracksVolumeDisplay.textContent = `${tracksVolume} dB`;

    backgroundVolumeSlider.addEventListener('input', function () {
        backgroundVolume = Tone.gainToDb(parseFloat(backgroundVolumeSlider.value));
        backgroundVolumeDisplay.textContent = `${backgroundVolume.toFixed(1)} dB`;
        if (backgroundTrack && playingSquares.length > 0) {
            // Other tracks are playing, adjust background track volume to new backgroundVolume
            backgroundTrack.volume.rampTo(backgroundVolume, 0.1);
        }
    });

    tracksVolumeSlider.addEventListener('input', function () {
        tracksVolume = Tone.gainToDb(parseFloat(tracksVolumeSlider.value));
        tracksVolumeDisplay.textContent = `${tracksVolume.toFixed(1)} dB`;
        // Recalculate volumes of playing tracks
        handleAudioPlayback();
    });

    async function userInteracted() {
        try {
            await Tone.start();
            console.log('Audio context started');
        } catch (error) {
            console.error('Failed to start audio context:', error);
        }
    }

    function startBackgroundTrack() {
        backgroundTrack = new Tone.Player({
            url: 'static/audio/group1/group1_background1.mp3',
            loop: true,
            autostart: true,
            volume: bgDynamicVolume
        }).toDestination();
        backgroundTrack.fadeIn = bgFadeDuration / 1000; // Convert ms to seconds
    }

    function handleAudioPlayback() {
        let tracks = getTracks(); // Get the tracks based on the current language

        let squareWeights = [];
        let totalWeight = 0;

        blueSquares.forEach(square => {
            let weight = getWeight(square, dotX, dotY);
            if (weight > 0) {
                squareWeights.push({ square: square, weight: weight });
                totalWeight += weight;
            }
        });

        if (totalWeight > 0) {
            // Normalize weights
            squareWeights.forEach(item => {
                item.weight /= totalWeight;
            });

            let currentPlayingSquares = squareWeights.map(item => item.square.number);

            // Start or adjust tracks
            squareWeights.forEach(item => {
                let squareNumber = item.square.number;
                let weight = item.weight;
                let trackKey = `location${squareNumber}`;
                if (tracks[trackKey]) {
                    if (!trackPlayers[squareNumber]) {
                        // Start the track
                        trackPlayers[squareNumber] = new Tone.Player({
                            url: tracks[trackKey],
                            loop: true,
                            volume: -Infinity,
                            autostart: true
                        }).toDestination();
                    }
                    // Adjust the volume, including tracksVolume
                    let adjustedVolume = tracksVolume + Tone.gainToDb(weight);
                    trackPlayers[squareNumber].volume.rampTo(adjustedVolume, 0.1);
                }
            });

            // Fade out and stop tracks that are no longer needed
            playingSquares.forEach(squareNumber => {
                if (!currentPlayingSquares.includes(squareNumber)) {
                    if (trackPlayers[squareNumber]) {
                        trackPlayers[squareNumber].volume.rampTo(-Infinity, 0.5);
                        // Stop after fading out
                        setTimeout(() => {
                            trackPlayers[squareNumber].stop();
                            delete trackPlayers[squareNumber];
                        }, 500);
                    }
                }
            });

            // Update playingSquares
            playingSquares = currentPlayingSquares.slice();
        } else {
            // No squares are active, fade out all tracks
            playingSquares.forEach(squareNumber => {
                if (trackPlayers[squareNumber]) {
                    trackPlayers[squareNumber].volume.rampTo(-Infinity, 0.5);
                    setTimeout(() => {
                        trackPlayers[squareNumber].stop();
                        delete trackPlayers[squareNumber];
                    }, 500);
                }
            });
            playingSquares = [];
        }

        // Adjust background track volume based on whether other tracks are playing
        if (backgroundTrack) {
            if (playingSquares.length > 0) {
                // Other tracks are playing, fade background track volume down to backgroundVolume (slider value)
                backgroundTrack.volume.rampTo(backgroundVolume, bgFadeDuration / 1000);
            } else {
                // No other tracks are playing, fade background track volume up to bgDynamicVolume
                backgroundTrack.volume.rampTo(bgDynamicVolume, bgFadeDuration / 1000);
            }
        }
    }

    function getWeight(square, dotX, dotY) {
        // Compute the distance from the red dot to the center of the square
        let centerX = square.x + square.w / 2;
        let centerY = square.y + square.h / 2;
        let dx = dotX - centerX;
        let dy = dotY - centerY;
        let distance = Math.sqrt(dx * dx + dy * dy);

        // Maximum distance is half the diagonal of the square
        let maxDistance = Math.sqrt((square.w / 2) ** 2 + (square.h / 2) ** 2);

        // If the dot is inside the square, weight is based on proximity to center
        if (square.contains(dotX, dotY)) {
            return 1 - (distance / maxDistance);
        } else {
            return 0;
        }
    }

    class DraggableSquare {
        constructor(x, y, w, h, col, number) {
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
            this.col = col;
            this.number = number;
            this.dragging = false;
        }

        show() {
            p5Instance.fill(this.col);
            p5Instance.noStroke();
            p5Instance.rect(this.x, this.y, this.w, this.h);
        }

        showNumber() {
            p5Instance.fill('#942023');
            p5Instance.textSize(this.w * 0.8);
            p5Instance.textAlign(p5Instance.CENTER, p5Instance.CENTER);
            p5Instance.textFont('Arial');
            p5Instance.text(this.number, this.x + this.w / 2, this.y + this.h / 2);
        }

        update(mx, my) {
            if (this.dragging) {
                this.x = mx - this.w / 2;
                this.y = my - this.h / 2;
            }
        }

        pressed(mx, my) {
            if (mx > this.x && mx < this.x + this.w && my > this.y && my < this.y + this.h) {
                this.dragging = true;
            }
        }

        released() {
            this.dragging = false;
        }

        contains(px, py) {
            return px > this.x && px < this.x + this.w && py > this.y && py < this.y + this.h;
        }
    }

    let sketch = function (p) {
        // Assign p5 instance to global variable
        p5Instance = p;

        let canvasSize = 800;
        let dotSize = 30;
        let moveW = false, moveA = false, moveS = false, moveD = false;
        let overlayImage;
        let controlPoints = [
            { imageX: 40, imageY: 39.61, latitude: 22.5560, longitude: 114.0918 },  // point 1
            { imageX: 50, imageY: 320.61, latitude: 22.5542, longitude: 114.0918 }, // point 2
            { imageX: 59, imageY: 696.61, latitude: 22.5520, longitude: 114.0918 }, // point 3
            { imageX: 370, imageY: 88.61, latitude: 22.5557, longitude: 114.0939 }, // point 4
            { imageX: 176, imageY: 167.61, latitude: 22.5551, longitude: 114.0927 }, // point 5
            { imageX: 245, imageY: 387.61, latitude: 22.5557, longitude: 114.0939 }, // point 6
            { imageX: 255, imageY: 675.61, latitude: 22.5519, longitude: 114.0933 }, // point 7
            { imageX: 678, imageY: 322.61, latitude: 22.5530, longitude: 114.0961 }, // point 8
        ];
        let { paramsLat, paramsLon } = computeBilinearParameters(controlPoints);

        p.preload = function () {
            overlayImage = p.loadImage('static/images/map.png');
        };

        p.setup = function () {
            let canvas = p.createCanvas(canvasSize, canvasSize);
            canvas.parent('canvasContainer');
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.zIndex = '2';

            // Assign to global variables
            dotX = p.width / 2;
            dotY = p.height / 2;

            // Load saved blue squares from localStorage if available
            let savedSquares = JSON.parse(localStorage.getItem('blueSquares'));
            if (savedSquares) {
                blueSquares = savedSquares.map(sq => new DraggableSquare(sq.x, sq.y, sq.w, sq.h, p.color(255, 0, 0, 100), sq.number));
            } else {
                blueSquares = [new DraggableSquare(150, 150, 80, 80, p.color(255, 0, 0, 100), 1)];
            }

            // Create + button
            let addButton = p.createButton('+');
            addButton.position(p.width, p.height * 0.25);
            addButton.style('background-color', '#92b7c1');
            addButton.style('color', 'white');
            addButton.style('font-size', '40px');
            addButton.style('padding', '10px 20px');
            addButton.style('outline', 'none');
            addButton.style('border', '#92b7c1');
            addButton.style('border-radius', '5px');
            addButton.mousePressed(addSquare);
        };

        p.draw = function () {
            p.clear();
            p.image(overlayImage, 0, 0, canvasSize, canvasSize);

            // Compute the red dot's geographic coordinates
            let geoCoords = imageToGeo(dotX, dotY);

            // Display the coordinates
            latLonDisplay.innerHTML = `Latitude: ${geoCoords.latitude.toFixed(4)}, Longitude: ${geoCoords.longitude.toFixed(4)}`;

            const step = 1;
            if (moveW) {
                dotY = p.max(dotY - step, dotSize / 2);
            }
            if (moveS) {
                dotY = p.min(dotY + step, p.height - dotSize / 2);
            }
            if (moveA) {
                dotX = p.max(dotX - step, dotSize / 2);
            }
            if (moveD) {
                dotX = p.min(dotX + step, p.width - dotSize / 2);
            }

            // Draw squares in the correct order to maintain layering
            blueSquares.forEach(square => {
                square.update(p.mouseX, p.mouseY);
                square.show();
                square.showNumber();
            });

            p.fill('#cb3431');
            p.noStroke();
            p.ellipse(dotX, dotY, dotSize, dotSize);

            if (isPlaying) {
                handleAudioPlayback();
            }
        };

        p.mousePressed = function () {
            for (let i = blueSquares.length - 1; i >= 0; i--) {
                let square = blueSquares[i];
                square.pressed(p.mouseX, p.mouseY);
                if (square.dragging) {
                    // Bring the selected square to the front
                    blueSquares.push(blueSquares.splice(i, 1)[0]);
                    break;
                }
            }
        };

        p.mouseReleased = function () {
            blueSquares.forEach(square => square.released());
            saveBlueSquares(); // Save squares when released
        };

        p.keyPressed = function () {
            if (p.key === 'w' || p.key === 'W') {
                moveW = true;
            } else if (p.key === 's' || p.key === 'S') {
                moveS = true;
            } else if (p.key === 'a' || p.key === 'A') {
                moveA = true;
            } else if (p.key === 'd' || p.key === 'D') {
                moveD = true;
            } else if (p.keyCode === p.DELETE || p.keyCode === p.BACKSPACE) {
                // Delete selected square
                let draggingSquare = blueSquares.find(sq => sq.dragging);
                if (draggingSquare) {
                    blueSquares = blueSquares.filter(sq => sq !== draggingSquare);
                    // Reassign numbers to maintain sequential order
                    blueSquares.forEach((square, index) => {
                        square.number = index + 1;
                    });
                    saveBlueSquares(); // Save squares after removing
                }
            } else if (p.keyIsDown(p.UP_ARROW)) {
                // Increase height
                let draggingSquare = blueSquares.find(sq => sq.dragging);
                if (draggingSquare) {
                    draggingSquare.h = p.min(draggingSquare.h + 5, canvasSize);
                    saveBlueSquares(); // Save changes after resizing
                }
            } else if (p.keyIsDown(p.DOWN_ARROW)) {
                // Decrease height
                let draggingSquare = blueSquares.find(sq => sq.dragging);
                if (draggingSquare) {
                    draggingSquare.h = p.max(draggingSquare.h - 5, 10);
                    saveBlueSquares(); // Save changes after resizing
                }
            } else if (p.keyIsDown(p.LEFT_ARROW)) {
                // Decrease width
                let draggingSquare = blueSquares.find(sq => sq.dragging);
                if (draggingSquare) {
                    draggingSquare.w = p.min(draggingSquare.w - 5, canvasSize);
                    saveBlueSquares(); // Save changes after resizing
                }
            } else if (p.keyIsDown(p.RIGHT_ARROW)) {
                // Increase width
                let draggingSquare = blueSquares.find(sq => sq.dragging);
                if (draggingSquare) {
                    draggingSquare.w = p.max(draggingSquare.w + 5, 10);
                    saveBlueSquares(); // Save changes after resizing
                }
            }
        };

        p.keyReleased = function () {
            if (p.key === 'w' || p.key === 'W') {
                moveW = false;
            } else if (p.key === 's' || p.key === 'S') {
                moveS = false;
            } else if (p.key === 'a' || p.key === 'A') {
                moveA = false;
            } else if (p.key === 'd' || p.key === 'D') {
                moveD = false;
            } else if (p.key === 'p' || p.key === 'P') {
                blueSquares.forEach(square => {
                    let topRightGeo = imageToGeo(square.x + square.w, square.y);
                    let bottomLeftGeo = imageToGeo(square.x, square.y + square.h);
                    console.log(`square${square.number}: bottom left lat: ${bottomLeftGeo.latitude.toFixed(4)}, long: ${bottomLeftGeo.longitude.toFixed(4)}, top right lat: ${topRightGeo.latitude.toFixed(4)}, long: ${topRightGeo.longitude.toFixed(4)}`);
                });
            }
        };

        function addSquare() {
            let maxNumber = blueSquares.reduce((max, square) => Math.max(max, square.number), 0);
            let newNumber = maxNumber + 1;
            blueSquares.push(new DraggableSquare(150, 150, 80, 80, p.color(255, 0, 0, 100), newNumber));
            saveBlueSquares(); // Save squares after adding
        }

        function saveBlueSquares() {
            let squaresData = blueSquares.map(square => ({
                x: square.x,
                y: square.y,
                w: square.w,
                h: square.h,
                number: square.number
            }));
            localStorage.setItem('blueSquares', JSON.stringify(squaresData));
        }

        function computeBilinearParameters(points) {
            let N = points.length;
            if (N < 4) {
                alert('At least four control points are required for bilinear interpolation.');
                return null;
            }

            let A = [];
            let B_lat = [];
            let B_lon = [];

            for (let i = 0; i < N; i++) {
                let x = points[i].imageX;
                let y = points[i].imageY;
                let lat = points[i].latitude;
                let lon = points[i].longitude;

                // Equation for latitude and longitude
                A.push([1, x, y, x * y]);
                B_lat.push(lat);
                B_lon.push(lon);
            }

            // Compute the pseudo-inverse of A
            let A_mat = math.matrix(A);
            let B_lat_mat = math.matrix(B_lat);
            let B_lon_mat = math.matrix(B_lon);

            let A_pinv = math.pinv(A_mat);

            // Solve for parameters: params = A_pinv * B
            let paramsLat = math.multiply(A_pinv, B_lat_mat);
            let paramsLon = math.multiply(A_pinv, B_lon_mat);

            // Convert solutions to arrays
            paramsLat = paramsLat.valueOf().flat();
            paramsLon = paramsLon.valueOf().flat();

            return { paramsLat, paramsLon };
        }

        function imageToGeo(x, y) {
            let a0 = paramsLat[0], a1 = paramsLat[1], a2 = paramsLat[2], a3 = paramsLat[3];
            let b0 = paramsLon[0], b1 = paramsLon[1], b2 = paramsLon[2], b3 = paramsLon[3];

            let lat = a0 + a1 * x + a2 * y + a3 * x * y;
            let lon = b0 + b1 * x + b2 * y + b3 * x * y;

            return { latitude: lat, longitude: lon };
        }
    };

    p5Instance = new p5(sketch);

    // Play button click event
    let playButton = document.getElementById('playButton');
    playButton.addEventListener('click', async function () {
        if (!isPlaying) {
            isPlaying = true;
            await userInteracted();
            startBackgroundTrack();
            playButton.src = 'static/images/pauseButton.png';
        } else {
            isPlaying = false;
            if (backgroundTrack) {
                backgroundTrack.stop();
                backgroundTrack = null;
            }
            // Stop all playing tracks
            Object.values(trackPlayers).forEach(player => {
                player.stop();
            });
            trackPlayers = {};
            playingSquares = [];
            playButton.src = 'static/images/playButton.png';
        }
    });
});
