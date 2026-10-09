"""Prepara una clip di Kling per la libreria di Spinta: rimette fermi i tre telefoni dell'immagine di partenza
(Kling storpia le scritte), H.264 720x1280 senza audio, poster 360x640."""
import sys, subprocess, cv2, numpy as np
src, out, poster = sys.argv[1], sys.argv[2], sys.argv[3]
import os; ref = cv2.imread(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'partenza_app.png'))
H, W = ref.shape[:2]
m = np.zeros((H, W), np.float32); m[1052:] = 1; m = cv2.GaussianBlur(m, (0, 0), 6)[..., None]
cap = cv2.VideoCapture(src); fps = cap.get(cv2.CAP_PROP_FPS) or 24
p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
                      '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out], stdin=subprocess.PIPE)
frames = []
while True:
    ok, f = cap.read()
    if not ok: break
    if f.shape[:2] != (H, W): f = cv2.resize(f, (W, H), interpolation=cv2.INTER_LANCZOS4)
    f = (f * (1 - m) + ref * m).astype(np.uint8); frames.append(f); p.stdin.write(f.tobytes())
p.stdin.close(); p.wait()
cv2.imwrite(poster, cv2.resize(frames[len(frames) // 2], (360, 640), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 85])
print('fatto', out, len(frames))
