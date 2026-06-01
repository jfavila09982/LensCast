import { useState, useRef, useEffect, useCallback } from "react";

const FAKE_NAMES = [
  "axelramirez","neonkitsune","cloudpilot_ph","techbro2026","lurker99",
  "mai_sunsets","hyperion_3k","jd_streams","roze_n_plays","bytes_ph",
  "manila_nights","codex_ph","streamer_fan","yohannes22","lila.watch",
];
const FAKE_COMMENTS = [
  "lets gooo 🔥","first!!","great stream!","hello from Manila!","subscribed ✅",
  "bro this is fire","keep it up!","what mic are you using?","smooth quality",
  "W streamer fr","hello from Cebu 👋","how long have you been streaming?",
  "nice setup!","this is sick","say hi to me pls","love the content!",
  "watching from BGC","grabe ang ganda ng stream","idol!","new sub here 🎉",
];

function formatDuration(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function ChatMessage({ user, text, color, isSystem }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5, padding: "2px 0" }}>
      <span style={{ color: color || "#818cf8", fontWeight: 700, marginRight: 6 }}>
        {user}
      </span>
      <span style={{ color: isSystem ? color : "#d1d5db" }}>{text}</span>
    </div>
  );
}

async function getVideoStreamWithFallbacks(isIOS, facingMode, selectedCamera, strictFacing = false) {
  const fallbackSets = isIOS
    ? [
        ...(strictFacing ? [{ facingMode: { exact: facingMode } }] : []),
        {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
        {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        { facingMode: { ideal: facingMode } },
        true,
      ]
    : [
        selectedCamera ? { deviceId: { exact: selectedCamera } } : { facingMode },
        { facingMode },
        true,
      ];

  let lastError = null;
  for (const video of fallbackSets) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        continue;
      }
      return stream;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Unable to open camera with fallback constraints");
}

function configureVideoElement(videoEl, stream) {
  videoEl.srcObject = stream;
  videoEl.muted = true;
  videoEl.defaultMuted = true;
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  videoEl.setAttribute("autoplay", "");
  videoEl.setAttribute("playsinline", "");
  videoEl.setAttribute("webkit-playsinline", "");
  videoEl.setAttribute("muted", "");

  const tryPlay = () => videoEl.play().catch((e) => console.log("play error:", e));
  videoEl.onloadedmetadata = tryPlay;
  videoEl.onloadeddata = tryPlay;
  return tryPlay();
}

export default function App() {
  const videoRef = useRef(null);
  const chatBottomRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const viewerRef = useRef(null);
  const chatTimerRef = useRef(null);
  const frameCheckTimeoutRef = useRef(null);

  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [facingMode, setFacingMode] = useState("user");
  const [viewers, setViewers] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bitrate, setBitrate] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [cameraError, setCameraError] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);

  const addMessage = useCallback((user, text, color, isSystem = false) => {
    setMessages((prev) => {
      const next = [...prev, { id: Date.now() + Math.random(), user, text, color, isSystem }];
      return next.slice(-80);
    });
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => stopEverything();
  }, []);

  function stopEverything() {
    clearInterval(timerRef.current);
    clearInterval(viewerRef.current);
    clearInterval(chatTimerRef.current);
    clearTimeout(frameCheckTimeoutRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startLive() {
    setCameraError(false);
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    try {
      const stream = await getVideoStreamWithFallbacks(isIOS, facingMode, "");

      if (videoRef.current) {
        await configureVideoElement(videoRef.current, stream);
      }

      streamRef.current = stream;
      setHasCamera(true);
      setIsLive(true);
      setDuration(0);

      clearTimeout(frameCheckTimeoutRef.current);
      frameCheckTimeoutRef.current = setTimeout(async () => {
        const videoEl = videoRef.current;
        if (!videoEl || !streamRef.current || !isIOS) return;
        const noFrames = videoEl.videoWidth === 0 || videoEl.readyState < 2;
        if (!noFrames) return;

        try {
          const recovery = await getVideoStreamWithFallbacks(true, facingMode, "");
          streamRef.current.getVideoTracks().forEach((t) => t.stop());
          streamRef.current.getAudioTracks().forEach((t) => recovery.addTrack(t));
          streamRef.current = recovery;
          await configureVideoElement(videoEl, recovery);
          addMessage("System", "Recovered camera preview automatically.", "#60a5fa", true);
        } catch (recoveryErr) {
          console.error("Video recovery failed:", recoveryErr);
        }
      }, 1800);

      // iOS Safari is more reliable when camera starts before microphone.
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micStream.getAudioTracks().forEach((track) => streamRef.current?.addTrack(track));
      } catch (micErr) {
        console.warn("Microphone unavailable. Continuing with video only.", micErr);
        addMessage("System", "Mic unavailable, continuing with video only.", "#f59e0b", true);
      }

      if (isMuted) streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));

      let fv = Math.floor(Math.random() * 8) + 2;
      setViewers(fv);

      const start = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - start) / 1000));
      }, 1000);

      viewerRef.current = setInterval(() => {
        fv = Math.max(0, fv + Math.floor(Math.random() * 5) - 1);
        setViewers(fv);
        setBitrate(Math.floor(Math.random() * 400) + 2700);
      }, 3000);

      chatTimerRef.current = setInterval(() => {
        if (Math.random() > 0.35) {
          const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
          const msg = FAKE_COMMENTS[Math.floor(Math.random() * FAKE_COMMENTS.length)];
          addMessage(name, msg);
        }
      }, 2200);

      addMessage("System", "Stream started — you are now LIVE! 🔴", "#4ade80", true);
    } catch (e) {
      setCameraError(true);
      console.error("Failed to start live stream:", e);
      addMessage("System", "Camera access denied. Please allow permissions.", "#f87171", true);
    }
  }

  function stopLive() {
    stopEverything();
    setIsLive(false);
    setHasCamera(false);
    setViewers(0);
    setBitrate(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    addMessage("System", "Stream ended. Thanks for going live!", "#9ca3af", true);
  }

  async function flipCamera() {
    const next = facingMode === "user" ? "environment" : "user";
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isLive && streamRef.current) {
      const prevStream = streamRef.current;
      try {
        const newStream = await getVideoStreamWithFallbacks(isIOS, next, "", true);

        prevStream.getAudioTracks().forEach((track) => newStream.addTrack(track));

        if (videoRef.current) {
          await configureVideoElement(videoRef.current, newStream);
        }

        prevStream.getVideoTracks().forEach((t) => t.stop());
        streamRef.current = newStream;
        if (isMuted) newStream.getAudioTracks().forEach((t) => (t.enabled = false));
        setFacingMode(next);
      } catch (e) {
        console.error("Failed to flip camera:", e);
        addMessage("System", "Could not switch camera on this device.", "#f59e0b", true);
      }
      return;
    }

    setFacingMode(next);
  }

  function toggleMic() {
    const next = !isMuted;
    setIsMuted(next);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
    }
  }

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    addMessage("you", text, "#fbbf24");
    setChatInput("");
  }

  return (
    <div style={styles.app}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.logo}>LensCast</div>
        {isLive && (
          <div style={styles.liveBadge}>
            <div style={styles.liveDot} />
            LIVE
          </div>
        )}
        <div style={styles.viewersChip}>
          👁 {viewers}
        </div>
      </div>

      {/* Video */}
      <div style={styles.videoWrapper}>
        {hasCamera ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            controls={false}
            style={styles.video}
          />
        ) : (
          <div style={styles.noCam}>
            <div style={{ fontSize: 40 }}>📷</div>
            <p style={{ color: "#555", fontSize: 14, marginTop: 8 }}>
              {cameraError ? "Camera permission denied" : "Press GO LIVE to start"}
            </p>
          </div>
        )}

        {/* Overlay badges */}
        {isLive && (
          <div style={styles.overlay}>
            <div style={styles.overlayTop}>
              <div style={styles.recBadge}>
                <div style={styles.recDot} />
                REC
              </div>
              <div style={styles.qualityBadge}>1080p</div>
            </div>
            <div style={styles.overlayBottom}>
              <div style={styles.durationBadge}>{formatDuration(duration)}</div>
              {bitrate && <div style={styles.qualityBadge}>{bitrate} kbps</div>}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        {[
          { label: "VIEWERS", value: viewers, color: "#e11d48" },
          { label: "DURATION", value: isLive ? `${String(Math.floor(duration/60)).padStart(2,"0")}:${String(duration%60).padStart(2,"0")}` : "--:--", color: "#fff" },
          { label: "STATUS", value: isLive ? "LIVE" : "OFFLINE", color: isLive ? "#e11d48" : "#555" },
        ].map((s) => (
          <div key={s.label} style={styles.statCard}>
            <div style={styles.statLabel}>{s.label}</div>
            <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <button style={styles.iconBtn} onClick={toggleMic} title="Toggle mic">
          {isMuted ? "🔇" : "🎙️"}
        </button>

        <button
          style={{
            ...styles.liveBtn,
            background: isLive ? "#1a1a1a" : "#e11d48",
            border: isLive ? "1px solid #e11d48" : "none",
            color: isLive ? "#e11d48" : "#fff",
          }}
          onClick={isLive ? stopLive : startLive}
        >
          {isLive ? "⏹ END STREAM" : "⏺ GO LIVE"}
        </button>

        <button style={styles.iconBtn} onClick={flipCamera} title="Flip camera">
          🔄
        </button>
      </div>

      {/* Chat */}
      <div style={styles.chat}>
        <div style={styles.chatHeader}>💬 LIVE CHAT</div>
        <div style={styles.chatMessages}>
          {messages.map((m) => (
            <ChatMessage key={m.id} {...m} />
          ))}
          <div ref={chatBottomRef} />
        </div>
        <div style={styles.chatInputRow}>
          <input
            style={styles.chatInput}
            type="text"
            placeholder="Say something..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            maxLength={120}
          />
          <button style={styles.sendBtn} onClick={sendChat}>Send</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
    fontFamily: "'Courier New', monospace",
    display: "flex",
    flexDirection: "column",
    maxWidth: 480,
    margin: "0 auto",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 16px", background: "#111", borderBottom: "1px solid #222",
  },
  logo: { fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" },
  liveBadge: {
    display: "flex", alignItems: "center", gap: 6,
    background: "#e11d48", padding: "4px 10px", borderRadius: 4,
    fontSize: 11, fontWeight: 700, letterSpacing: 2,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: "50%", background: "#fff",
    animation: "blink 1s infinite",
  },
  viewersChip: { fontSize: 12, color: "#888" },
  videoWrapper: { position: "relative", background: "#000", minHeight: 260 },
  video: {
    width: "100%",
    minHeight: 260,
    maxHeight: 320,
    objectFit: "cover",
    display: "block",
    background: "#000",
  },
  noCam: {
    width: "100%", height: 260, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
  },
  overlay: {
    position: "absolute", inset: 0, display: "flex",
    flexDirection: "column", justifyContent: "space-between", padding: 10,
    pointerEvents: "none",
  },
  overlayTop: { display: "flex", justifyContent: "space-between" },
  overlayBottom: { display: "flex", justifyContent: "space-between" },
  recBadge: {
    display: "flex", alignItems: "center", gap: 5,
    background: "rgba(0,0,0,0.6)", padding: "3px 8px", borderRadius: 4,
    fontSize: 11,
  },
  recDot: { width: 7, height: 7, borderRadius: "50%", background: "#e11d48" },
  qualityBadge: {
    background: "rgba(0,0,0,0.55)", padding: "3px 7px", borderRadius: 4,
    fontSize: 10, color: "#aaa", letterSpacing: 1,
  },
  durationBadge: {
    background: "rgba(0,0,0,0.6)", padding: "3px 8px", borderRadius: 4,
    fontSize: 12, letterSpacing: 1,
  },
  statsRow: {
    display: "flex", gap: 8, padding: "12px 16px",
    background: "#111", borderBottom: "1px solid #1a1a1a",
  },
  statCard: {
    flex: 1, background: "#161616", border: "1px solid #222",
    borderRadius: 6, padding: "8px 10px", textAlign: "center",
  },
  statLabel: { fontSize: 9, color: "#555", letterSpacing: 2, marginBottom: 4 },
  statValue: { fontSize: 15, fontWeight: 700 },
  controls: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 14, padding: "12px 16px", background: "#111",
    borderBottom: "1px solid #1a1a1a",
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: "50%",
    background: "#1e1e1e", border: "1px solid #2a2a2a",
    fontSize: 20, cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center",
  },
  liveBtn: {
    padding: "12px 28px", borderRadius: 6, fontSize: 13,
    fontWeight: 700, letterSpacing: 2, cursor: "pointer",
    fontFamily: "'Courier New', monospace",
  },
  chat: {
    flex: 1, display: "flex", flexDirection: "column",
    background: "#0d0d0d", minHeight: 200,
  },
  chatHeader: {
    padding: "8px 14px", fontSize: 10, letterSpacing: 2, color: "#555",
    borderBottom: "1px solid #1a1a1a",
  },
  chatMessages: {
    flex: 1, overflowY: "auto", padding: "8px 14px",
    display: "flex", flexDirection: "column", gap: 4,
    maxHeight: 220,
  },
  chatInputRow: {
    display: "flex", gap: 8, padding: "8px 14px",
    borderTop: "1px solid #1a1a1a",
  },
  chatInput: {
    flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a",
    borderRadius: 4, color: "#fff", fontSize: 13, padding: "7px 10px",
    outline: "none", fontFamily: "inherit",
  },
  sendBtn: {
    background: "#6366f1", border: "none", color: "#fff",
    borderRadius: 4, padding: "7px 14px", cursor: "pointer",
    fontSize: 13, fontFamily: "inherit",
  },
};
