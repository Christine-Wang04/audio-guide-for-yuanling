document.addEventListener('DOMContentLoaded', function () {
    let playButton = document.getElementById('playButton');
    if (playButton) {
        playButton.addEventListener('click', togglePlayback);
    }
});

window.audioContextStarted = window.audioContextStarted || false;

let currentTrack = null;
let fadeInDuration = 2000; // adjust as needed
let fadeOutDuration = 2000; // adjust as needed
let currentlyPlayingLocation = null; // track which location's track is currently playing
let tracks = {
    "location1": "static/audio/group3/group3_track1.mp3",
    "location2": "static/audio/group3/group3_track2.mp3",
    "location3": "static/audio/group3/group3_track3.mp3",
    "location4": "static/audio/group3/group3_track4.mp3",
    "location5": "static/audio/group3/group3_track5.mp3",
    "location6": "static/audio/group3/group3_track6.mp3"
    // add more below...
};

let isPlaying = false;
let backgroundTrack = null;
let isTrackLoading = false;

async function userInteracted() {
    if (!window.audioContextStarted) {
        try {
            await Tone.start();
            window.audioContextStarted = true;
            console.log('audio context started.');
        } catch (error) {
            console.error('failed to start audio context:', error);
        }
    } else {
        console.log('audio context already started.');
    }
}

// background track
function startBackgroundTrack() {
    const backgroundFile = "static/audio/group3/group3_background3.mp3.mp3";
    loadAndPlayAudio(backgroundFile, true, true, function(player) {
        backgroundTrack = player;
        console.log("background track started.");
    });
    backgroundTrack.volume.value = -12; // set the background track volume here
}

async function togglePlayback() {
    let playButton = document.getElementById('playButton');

    if (isPlaying) {
        stopAllPlayback(true);
        playButton.src = 'static/images/playButton.png';
        isPlaying = false;
    } else {
        isPlaying = true;
        playButton.src = 'static/images/pauseButton.png';
        console.log("user initiated playback. GPS-based playback now enabled.");

        // ensure the Tone.js audio context is started
        await userInteracted();

        // start the background track
        startBackgroundTrack();

        // if current location is available, call handleLocationChange()
        if (typeof window.latitude !== 'undefined' && typeof window.longitude !== 'undefined') {
            handleLocationChange(window.latitude, window.longitude);
        } else {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        let latitude = position.coords.latitude;
                        let longitude = position.coords.longitude;

                        window.latitude = latitude;
                        window.longitude = longitude;

                        handleLocationChange(latitude, longitude);
                    },
                    function(error) {
                        console.error("Error getting current position: ", error);
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            } else {
                console.error('Geolocation is not supported by your browser.');
            }
        }
    }
}

function stopAllPlayback(userStopped = false) {
    if (currentTrack) {
        currentTrack.stop(); // stops immediately with fade out applied
        currentTrack = null;
        currentlyPlayingLocation = null;
        isTrackLoading = false; // reset loading flag
    }

    if (backgroundTrack) {
        backgroundTrack.stop(); // stops with fade out applied
        backgroundTrack = null;
        console.log("background track stopped.");
    }

    if (userStopped) {
        isPlaying = false;
        console.log("user stopped playback.");
    } else {
        console.log("playback stopped due to location change.");
    }
}

function playTrack(trackFile, locationKey) {
    if ((currentTrack || isTrackLoading) && currentlyPlayingLocation === locationKey) return;

    if (currentTrack && currentlyPlayingLocation !== locationKey) {
        console.log('crossfading to new track...');

        let oldTrack = currentTrack;

        // start the new track
        startNewTrack(trackFile, locationKey, true);

        // stop the old track
        oldTrack.stop(); // stops with fade out applied
    } else if (!currentTrack && !isTrackLoading) {
        startNewTrack(trackFile, locationKey, true);
    }
}

function startNewTrack(trackFile, locationKey, fadeIn = false) {
    if (isTrackLoading) {
        console.log('track is already loading. Skipping startNewTrack.');
        return;
    }
    isTrackLoading = true; // set loading flag to true
    currentlyPlayingLocation = locationKey; // set this immediately

    console.log(`attempting to start new track: ${trackFile}`);

    loadAndPlayAudio(trackFile, false, fadeIn, function(player) {
        currentTrack = player;
        isTrackLoading = false; // reset loading flag
        console.log(`playing track: ${trackFile}`);
    });
}

function loadAndPlayAudio(file, loop = true, fadeIn = false, callback) {
    const player = new Tone.Player({
        url: file,
        autostart: false,
        loop: loop,
        fadeOut: fadeOutDuration / 1000, // set fadeOut here
        onload: () => {
            player.toDestination();
            player.fadeIn = fadeIn ? fadeInDuration / 1000 : 0;
            player.start();
            if (callback) callback(player);
        },
        onstop: () => {
            // dispose of the player when it stops
            player.dispose();
            console.log(`player for ${file} stopped and disposed.`);
        },
        onerror: (error) => {
            console.error(`error loading ${file}:`, error);
        }
    });
}

async function handleLocationChange(latitude, longitude) {
    console.log(`handleLocationChange called with latitude: ${latitude}, longitude: ${longitude}`);

    if (!isPlaying) {
        console.log("playback is not active. Ignoring GPS location check.");
        return;
    }

    if (!window.audioContextStarted) {
        await userInteracted();
    }

    // adjust the following conditions for actual location-based playback
    if (latitude > 22.5525 && latitude < 22.5540 && longitude > 114.0940 && longitude < 114.0955) {
        playTrack(tracks["location1"], "location1");
    } else if (latitude > 22.5530 && latitude < 22.5540 && longitude > 114.0955 && longitude < 114.0960) {
        playTrack(tracks["location2"], "location2");
    } else if (latitude > 22.5540 && latitude < 22.5550 && longitude > 114.0955 && longitude < 114.0960) {
        playTrack(tracks["location3"], "location3");
    } else if (latitude > 22.5530 && latitude < 22.5540 && longitude > 114.0940 && longitude < 114.9950) {
        playTrack(tracks["location4"], "location4");
    } else if (latitude > 22.5540 && latitude < 22.5545 && longitude > 114.0930 && longitude < 114.0940) {
        playTrack(tracks["location5"], "location5");
    } else if (latitude > 22.5530 && latitude < 22.5540 && longitude > 114.0930 && longitude < 114.0940) {
        playTrack(tracks["location6"], "location6");
    } else {
        console.log("no track assigned for this location.");
        // optionally, stop the current track if not in any location
        if (currentTrack) {
            currentTrack.fadeOut = fadeOutDuration / 1000; // in seconds
            currentTrack.stop("+0"); // stops with fade out applied
            currentTrack = null;
            currentlyPlayingLocation = null;
        }
    }
}

// attach handleLocationChange to the window object so it can be accessed globally
window.handleLocationChange = handleLocationChange;
