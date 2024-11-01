document.addEventListener('DOMContentLoaded', function () {
    // get the container element
    let container = document.getElementById('canvasContainer');
    container.style.position = 'relative';

    // create the display element
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

    // insert it before the canvasContainer
    container.parentNode.insertBefore(latLonDisplay, container.nextSibling);

    let isPlaying = false;
    let backgroundTrack = null;
    let tracks = {
        "location1": "static/audio/group1/group1_track1.mp3",
        "location2": "static/audio/group1/group1_track2.mp3",
        "location3": "static/audio/group1/group1_track3.mp3",
        "location4": "static/audio/group1/group1_track4.mp3",
        "location5": "static/audio/group1/group1_track5.mp3",
        "location6": "static/audio/group1/group1_track6.mp3"
    };
    let trackPlayers = {}; // to keep track of all playing tracks
    let playingSquares = [];

    // volume sliders
    let backgroundVolumeSlider = document.getElementById('backgroundVolume');
    let tracksVolumeSlider = document.getElementById('tracksVolume');

    // create volume display labels
    let backgroundVolumeDisplay = document.createElement('span');
    backgroundVolumeDisplay.id = 'backgroundVolumeDisplay';
    backgroundVolumeDisplay.style.marginLeft = '10px';
    backgroundVolumeSlider.parentNode.appendChild(backgroundVolumeDisplay);

    let tracksVolumeDisplay = document.createElement('span');
    tracksVolumeDisplay.id = 'tracksVolumeDisplay';
    tracksVolumeDisplay.style.marginLeft = '10px';
    tracksVolumeSlider.parentNode.appendChild(tracksVolumeDisplay);

    // set initial volume levels
    let backgroundVolume = -12;
    let tracksVolume = -12;

    // update volume displays
    backgroundVolumeDisplay.textContent = `${backgroundVolume} dB`;
    tracksVolumeDisplay.textContent = `${tracksVolume} dB`;

    backgroundVolumeSlider.addEventListener('input', function () {
        backgroundVolume = Tone.gainToDb(parseFloat(backgroundVolumeSlider.value));
        backgroundVolumeDisplay.textContent = `${backgroundVolume.toFixed(1)} dB`;
        if (backgroundTrack) {
            backgroundTrack.volume.rampTo(backgroundVolume, 0.1);
        }
    });

    tracksVolumeSlider.addEventListener('input', function () {
        tracksVolume = Tone.gainToDb(parseFloat(tracksVolumeSlider.value));
        tracksVolumeDisplay.textContent = `${tracksVolume.toFixed(1)} dB`;
        Object.values(trackPlayers).forEach(player => {
            player.volume.rampTo(tracksVolume, 0.1);
        });
    });


    async function userInteracted() {
        try {
            await Tone.start();
            console.log('audio context started');
        } catch (error) {
            console.error('failed to start audio context:', error);
        }
    }

    function startBackgroundTrack() {
        backgroundTrack = new Tone.Player({
            url: 'static/audio/group1/group1_background1.mp3',
            loop: true,
            autostart: true,
            volume: backgroundVolume
        }).toDestination();
        backgroundTrack.fadeIn = 2;
    }

    let sketch = function (p) {
        let dotX, dotY;
        let canvasSize = 800;
        let dotSize = 30;
        let moveW = false, moveA = false, moveS = false, moveD = false;
        let overlayImage;
        let blueSquares = [];
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

            dotX = p.width / 2;
            dotY = p.height / 2;

            // load saved blue squares from localStorage if available
            let savedSquares = JSON.parse(localStorage.getItem('blueSquares'));
            if (savedSquares) {
                blueSquares = savedSquares.map(sq => new DraggableSquare(sq.x, sq.y, sq.w, sq.h, p.color(255, 0, 0, 100), sq.number));
            } else {
                blueSquares.push(new DraggableSquare(150, 150, 80, 80, p.color(255, 0, 0, 100), 1));
            }

            // create + button
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

            // compute the red dot's geographic coordinates
            let geoCoords = imageToGeo(dotX, dotY);

            // display the coordinates
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

            // draw squares in the correct order to maintain layering
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
                    // bring the selected square to the front
                    blueSquares.push(blueSquares.splice(i, 1)[0]);
                    break;
                }
            }
        };

        p.mouseReleased = function () {
            blueSquares.forEach(square => square.released());
            saveBlueSquares(); // save squares when released
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
                    // reassign numbers to maintain sequential order
                    blueSquares.forEach((square, index) => {
                        square.number = index + 1;
                    });
                    saveBlueSquares(); // save squares after removing
                }
            } else if (p.keyIsDown(p.UP_ARROW)) {
                // increase height
                let draggingSquare = blueSquares.find(sq => sq.dragging);
                if (draggingSquare) {
                    draggingSquare.h = p.min(draggingSquare.h + 5, canvasSize);
                    saveBlueSquares(); // save changes after resizing
                }
            } else if (p.keyIsDown(p.DOWN_ARROW)) {
                // decrease height
                let draggingSquare = blueSquares.find(sq => sq.dragging);
                if (draggingSquare) {
                    draggingSquare.h = p.max(draggingSquare.h - 5, 10);
                    saveBlueSquares(); // save changes after resizing
                }
            } else if (p.keyIsDown(p.LEFT_ARROW)) {
                // decrease width
                let draggingSquare = blueSquares.find(sq => sq.dragging);
                if (draggingSquare) {
                    draggingSquare.w = p.min(draggingSquare.w - 5, canvasSize);
                    saveBlueSquares(); // save changes after resizing
                }
            } else if (p.keyIsDown(p.RIGHT_ARROW)) {
                // increase width
                let draggingSquare = blueSquares.find(sq => sq.dragging);
                if (draggingSquare) {
                    draggingSquare.w = p.max(draggingSquare.w + 5, 10);
                    saveBlueSquares(); // save changes after resizing
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
            } else if(p.key === 'p' || p.key === 'P') {
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
            saveBlueSquares(); // save squares after adding
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

        function handleAudioPlayback() {
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
                // normalize weights
                squareWeights.forEach(item => {
                    item.weight /= totalWeight;
                });

                let currentPlayingSquares = squareWeights.map(item => item.square.number);

                // start or adjust tracks
                squareWeights.forEach(item => {
                    let squareNumber = item.square.number;
                    let weight = item.weight;
                    let trackKey = `location${squareNumber}`;
                    if (tracks[trackKey]) {
                        if (!trackPlayers[squareNumber]) {
                            // start the track
                            trackPlayers[squareNumber] = new Tone.Player({
                                url: tracks[trackKey],
                                loop: true,
                                volume: -Infinity,
                                autostart: true
                            }).toDestination();
                        }
                        // adjust the volume
                        trackPlayers[squareNumber].volume.rampTo(Tone.gainToDb(weight), 0.1);
                    }
                });

                // fade out and stop tracks that are no longer needed
                playingSquares.forEach(squareNumber => {
                    if (!currentPlayingSquares.includes(squareNumber)) {
                        if (trackPlayers[squareNumber]) {
                            trackPlayers[squareNumber].volume.rampTo(-Infinity, 0.5);
                            // stop after fading out
                            setTimeout(() => {
                                trackPlayers[squareNumber].stop();
                                delete trackPlayers[squareNumber];
                            }, 500);
                        }
                    }
                });

                // update playingSquares
                playingSquares = currentPlayingSquares.slice();
            } else {
                // no squares are active, fade out all tracks
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
        }

        function getWeight(square, dotX, dotY) {
            // compute the distance from the red dot to the center of the square
            let centerX = square.x + square.w / 2;
            let centerY = square.y + square.h / 2;
            let dx = dotX - centerX;
            let dy = dotY - centerY;
            let distance = Math.sqrt(dx * dx + dy * dy);

            // maximum distance is half the diagonal of the square
            let maxDistance = Math.sqrt((square.w / 2) ** 2 + (square.h / 2) ** 2);

            // if the dot is inside the square, weight is based on proximity to center
            if (square.contains(dotX, dotY)) {
                return 1 - (distance / maxDistance);
            } else {
                return 0;
            }
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

                // equation for latitude and longitude
                A.push([1, x, y, x * y]);
                B_lat.push(lat);
                B_lon.push(lon);
            }

            // convert arrays to math.js matrices
            let A_mat = math.matrix(A);
            let B_lat_mat = math.matrix(B_lat);
            let B_lon_mat = math.matrix(B_lon);

            // compute the pseudo-inverse of A
            let A_pinv = math.pinv(A_mat);

            // solve for parameters: params = A_pinv * B
            let paramsLat = math.multiply(A_pinv, B_lat_mat);
            let paramsLon = math.multiply(A_pinv, B_lon_mat);

            // convert solutions to arrays
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
                p.fill(this.col);
                p.noStroke();
                p.rect(this.x, this.y, this.w, this.h);
            }

            showNumber() {
                p.fill('#942023');
                p.textSize(this.w * 0.8);
                p.textAlign(p.CENTER, p.CENTER);
                p.textFont('Arial');
                p.text(this.number, this.x + this.w / 2, this.y + this.h / 2);
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
    };

    new p5(sketch);

    // play button click event
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
