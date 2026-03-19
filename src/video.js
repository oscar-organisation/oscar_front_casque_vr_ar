// Handles video stream capture
// Currently uses webcam, will switch to Quest passthrough via WebXR

export async function initVideoStream() {
  const video = document.getElementById('video-feed');
  const status = document.getElementById('status');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: 'environment' // back camera when available (Quest)
      },
      audio: false
    });

    video.srcObject = stream;
    status.textContent = 'Flux camera actif';
    return video;
  } catch (error) {
    console.error('Camera access error:', error);
    status.textContent = 'Erreur: impossible d\'acceder a la camera';
    return null;
  }
}
