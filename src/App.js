import React, { useRef, useEffect, useState } from 'react';
import './App.css';

const icons = { rock: "🪨", paper: "📄", scissors: "✂️", bomb: "💣", shield: "🛡️" };
const colors = { rock: '#8B4513', paper: '#FFE4B5', scissors: '#C0C0C0', bomb: '#FF4500', shield: '#4169E1' };

class Particle {
  constructor(x, y, type, speed = 0.3) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = type === 'bomb' ? 15 : type === 'shield' ? 18 : 12;
    this.trail = [];
    this.power = type === 'bomb' ? 3 : type === 'shield' ? 5 : 1;
    this.glowing = type === 'bomb' || type === 'shield';
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  draw(ctx, showTrails = false) {
    // Draw trail
    if (showTrails && this.trail.length > 1) {
      ctx.strokeStyle = colors[this.type] + '40';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
    }
    
    // Draw glow effect
    if (this.glowing) {
      ctx.shadowColor = colors[this.type];
      ctx.shadowBlur = 20;
    }
    
    ctx.font = `${this.radius * 2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icons[this.type], this.x, this.y);
    
    ctx.shadowBlur = 0;
  }

  update(canvas, playSound) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 10) this.trail.shift();
    
    this.x += this.vx;
    this.y += this.vy;
    
    let hitBorder = false;
    if (this.x < this.radius || this.x > canvas.width - this.radius) {
      this.vx *= -1;
      this.x = this.x < this.radius ? this.radius : canvas.width - this.radius;
      hitBorder = true;
    }
    if (this.y < this.radius || this.y > canvas.height - this.radius) {
      this.vy *= -1;
      this.y = this.y < this.radius ? this.radius : canvas.height - this.radius;
      hitBorder = true;
    }
    
    if (hitBorder && playSound) {
      playSound('border');
    }
  }

  updateSpeed(newSpeed) {
    const currentSpeed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
    if (currentSpeed > 0) {
      this.vx = (this.vx / currentSpeed) * newSpeed;
      this.vy = (this.vy / currentSpeed) * newSpeed;
    }
  }
}

function collide(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < p1.radius + p2.radius) {
    // Separate particles to prevent sticking
    const overlap = (p1.radius + p2.radius) - dist;
    const separateX = (dx / dist) * (overlap / 2);
    const separateY = (dy / dist) * (overlap / 2);
    
    p1.x -= separateX;
    p1.y -= separateY;
    p2.x += separateX;
    p2.y += separateY;
    
    const speed1 = Math.sqrt(p1.vx*p1.vx + p1.vy*p1.vy);
    const speed2 = Math.sqrt(p2.vx*p2.vx + p2.vy*p2.vy);
    
    [p1.vx, p2.vx] = [p2.vx, p1.vx];
    [p1.vy, p2.vy] = [p2.vy, p1.vy];
    
    const newSpeed1 = Math.sqrt(p1.vx*p1.vx + p1.vy*p1.vy);
    const newSpeed2 = Math.sqrt(p2.vx*p2.vx + p2.vy*p2.vy);
    
    if (newSpeed1 > 0) {
      p1.vx = (p1.vx / newSpeed1) * speed1;
      p1.vy = (p1.vy / newSpeed1) * speed1;
    }
    if (newSpeed2 > 0) {
      p2.vx = (p2.vx / newSpeed2) * speed2;
      p2.vy = (p2.vy / newSpeed2) * speed2;
    }
    
    if (p1.type !== p2.type) {
      // Bomb converts everything in radius
      if (p1.type === 'bomb') {
        p2.type = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
        p1.power--;
        if (p1.power <= 0) p1.type = 'rock';
        return 'bomb';
      } else if (p2.type === 'bomb') {
        p1.type = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
        p2.power--;
        if (p2.power <= 0) p2.type = 'rock';
        return 'bomb';
      }
      // Shield protects from conversion
      else if (p1.type === 'shield' || p2.type === 'shield') {
        if (p1.type === 'shield') p1.power--;
        if (p2.type === 'shield') p2.power--;
        if (p1.power <= 0) p1.type = 'rock';
        if (p2.power <= 0) p2.type = 'paper';
        return 'shield';
      }
      // Normal RPS rules
      else if ((p1.type === 'rock' && p2.type === 'scissors') ||
               (p1.type === 'scissors' && p2.type === 'paper') ||
               (p1.type === 'paper' && p2.type === 'rock')) {
        p2.type = p1.type;
        return 'convert';
      } else {
        p1.type = p2.type;
        return 'convert';
      }
    } else if (p1.type === 'rock' && p2.type === 'rock') {
      return 'rock-rock';
    }
    return null;
  }
}

function App() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const runningRef = useRef(false);
  const startTimeRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [counts, setCounts] = useState({ rock: 0, paper: 0, scissors: 0 });
  const [winner, setWinner] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [rockCount, setRockCount] = useState(100);
  const [paperCount, setPaperCount] = useState(100);
  const [scissorsCount, setScissorsCount] = useState(100);
  const [powerUps, setPowerUps] = useState(false);
  const [trails, setTrails] = useState(false);
  const [sounds, setSounds] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [selectedType, setSelectedType] = useState('rock');
  const [isPlacing, setIsPlacing] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [controlsMinimized, setControlsMinimized] = useState(false);

  const mediaRecorderRef = useRef(null);
  const lastSoundTime = useRef(0);
  
  const playSound = (type) => {
    if (!sounds) return;
    const now = Date.now();
    if (now - lastSoundTime.current < 10) return;
    lastSoundTime.current = now;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      if (type === 'bomb') {
        // Explosion sound - rapid frequency drop
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
        osc.start();
        osc.stop(audioContext.currentTime + 0.2);
      } else if (type === 'shield') {
        // Metallic clang - square wave with reverb
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.type = 'square';
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
        osc.start();
        osc.stop(audioContext.currentTime + 0.15);
      } else if (type === 'convert') {
        // Pop sound - triangle wave
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.type = 'triangle';
        osc.frequency.value = 400;
        gain.gain.setValueAtTime(0.06, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
        osc.start();
        osc.stop(audioContext.currentTime + 0.1);
      } else if (type === 'rock-rock') {
        // Loud rock collision - deep thud
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.type = 'sine';
        osc.frequency.value = 150;
        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
        osc.start();
        osc.stop(audioContext.currentTime + 0.3);
      } else if (type === 'border') {
        // Border bounce - quick tick
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.type = 'sine';
        osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.03, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
        osc.start();
        osc.stop(audioContext.currentTime + 0.05);
      } else if (type === 'victory') {
        // Victory fanfare - ascending notes
        [440, 554, 659, 880].forEach((freq, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          const startTime = audioContext.currentTime + i * 0.15;
          gain.gain.setValueAtTime(0.1, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
          osc.start(startTime);
          osc.stop(startTime + 0.3);
        });
      }
    } catch (e) {
      console.log('Audio not supported');
    }
  };
  
  const spawnPowerUp = () => {
    if (!powerUps || Math.random() > 0.02) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const type = Math.random() > 0.5 ? 'bomb' : 'shield';
    particlesRef.current.push(new Particle(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      type,
      speed
    ));
  };

  const savePositions = () => {
    const positions = particlesRef.current.map(p => ({
      x: p.x, y: p.y, type: p.type, vx: p.vx, vy: p.vy
    }));
    localStorage.setItem('particlePositions', JSON.stringify(positions));
    alert('Positions saved!');
  };

  const loadPositions = () => {
    const saved = localStorage.getItem('particlePositions');
    if (saved) {
      const positions = JSON.parse(saved);
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      particlesRef.current = positions.map(p => {
        const particle = new Particle(p.x, p.y, p.type, speed);
        particle.vx = p.vx;
        particle.vy = p.vy;
        return particle;
      });
      
      startTimeRef.current = performance.now();
      runningRef.current = true;
      setWinner('');
      animate();
      alert('Positions loaded!');
    } else {
      alert('No saved positions found!');
    }
  };

  const startStream = async () => {
    const canvas = canvasRef.current;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rock-paper-scissors.webm';
      a.click();
    };
    
    recorder.start();
    mediaRecorderRef.current = recorder;
    setStreaming(true);
  };

  const stopStream = () => {
    mediaRecorderRef.current?.stop();
    setStreaming(false);
  };

  const init = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    runningRef.current = false;
    particlesRef.current = [];
    setWinner('');
    
    if (manualMode) {
      setIsPlacing(true);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    
    const newParticles = [];
    for (let i = 0; i < rockCount; i++) newParticles.push(new Particle(Math.random()*canvas.width, Math.random()*canvas.height, 'rock', speed));
    for (let i = 0; i < paperCount; i++) newParticles.push(new Particle(Math.random()*canvas.width, Math.random()*canvas.height, 'paper', speed));
    for (let i = 0; i < scissorsCount; i++) newParticles.push(new Particle(Math.random()*canvas.width, Math.random()*canvas.height, 'scissors', speed));
    particlesRef.current = newParticles;
    startTimeRef.current = performance.now();
    runningRef.current = true;
    setIsPlacing(false);
    animate();
  };

  const startSimulation = () => {
    if (particlesRef.current.length === 0) return;
    startTimeRef.current = performance.now();
    runningRef.current = true;
    setIsPlacing(false);
    animate();
  };

  const handleMouseDown = (e) => {
    if (!isPlacing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDragStart({ x, y });
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStart) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDragEnd({ x, y });
    renderCanvas();
  };

  const handleMouseUp = (e) => {
    if (!isDragging || !dragStart) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const width = Math.abs(x - dragStart.x);
    const height = Math.abs(y - dragStart.y);
    const area = width * height;
    const count = Math.max(1, Math.floor(area / 2000)); // 1 particle per 2000 pixels
    
    const minX = Math.min(dragStart.x, x);
    const maxX = Math.max(dragStart.x, x);
    const minY = Math.min(dragStart.y, y);
    const maxY = Math.max(dragStart.y, y);
    
    for (let i = 0; i < count; i++) {
      const px = minX + Math.random() * (maxX - minX);
      const py = minY + Math.random() * (maxY - minY);
      particlesRef.current.push(new Particle(px, py, selectedType, speed));
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    renderCanvas();
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const particles = particlesRef.current;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < particles.length; i++) {
      particles[i].draw(ctx, trails);
    }
    
    // Draw selection box
    if (isDragging && dragStart && dragEnd) {
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        Math.min(dragStart.x, dragEnd.x),
        Math.min(dragStart.y, dragEnd.y),
        Math.abs(dragEnd.x - dragStart.x),
        Math.abs(dragEnd.y - dragStart.y)
      );
      ctx.setLineDash([]);
    }
  };

  const animate = () => {
    if (!runningRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const particles = particlesRef.current;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < particles.length; i++) {
      particles[i].update(canvas, playSound);
      particles[i].draw(ctx, trails);
      for (let j = i + 1; j < particles.length; j++) {
        const collision = collide(particles[i], particles[j]);
        if (collision) playSound(collision);
      }
    }

    spawnPowerUp();
    
    const rockCount = particles.filter(p => p.type === 'rock').length;
    const paperCount = particles.filter(p => p.type === 'paper').length;
    const scissorsCount = particles.filter(p => p.type === 'scissors').length;
    const bombCount = particles.filter(p => p.type === 'bomb').length;
    const shieldCount = particles.filter(p => p.type === 'shield').length;
    const currentElapsed = ((performance.now() - startTimeRef.current) / 1000).toFixed(1);
    

    
    setCounts({ rock: rockCount, paper: paperCount, scissors: scissorsCount, bomb: bombCount, shield: shieldCount });
    setElapsed(currentElapsed);

    if ([rockCount, paperCount, scissorsCount].filter(c => c > 0).length === 1) {
      runningRef.current = false;
      const winnerType = rockCount > 0 ? 'Rock 🪨' : paperCount > 0 ? 'Paper 📄' : 'Scissors ✂️';
      setWinner(`${winnerType} Wins in ${currentElapsed}s!`);
      playSound('victory');
      return;
    }
    
    requestAnimationFrame(animate);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    init();
  }, []);

  useEffect(() => {
    if (manualMode) {
      init();
    }
  }, [manualMode]);



  useEffect(() => {
    particlesRef.current.forEach(particle => particle.updateSpeed(speed));
  }, [speed]);

  return (
    <div className="app">
      <div className="scoreboard">
        ⏱ Time: {elapsed}s | 🪨 {counts.rock} | 📄 {counts.paper} | ✂️ {counts.scissors} | 💣 {counts.bomb || 0} | 🛡️ {counts.shield || 0}
      </div>
      {winner && <div className="winner">{winner}</div>}
      {winner && <button className="restart" onClick={init}>Restart</button>}
      <div className={`controls ${controlsMinimized ? 'minimized' : ''}`}>
        <button className="toggle-controls" onClick={() => setControlsMinimized(!controlsMinimized)}>
          {controlsMinimized ? '⚙️' : '✕'}
        </button>
        {!controlsMinimized && (
        <>
        <div className="count-controls">
          <div className="count-item">
            <label>🪨: {rockCount}</label>
            <input type="range" min="0" max="200" value={rockCount} onChange={(e) => setRockCount(parseInt(e.target.value))} />
          </div>
          <div className="count-item">
            <label>📄: {paperCount}</label>
            <input type="range" min="0" max="200" value={paperCount} onChange={(e) => setPaperCount(parseInt(e.target.value))} />
          </div>
          <div className="count-item">
            <label>✂️: {scissorsCount}</label>
            <input type="range" min="0" max="200" value={scissorsCount} onChange={(e) => setScissorsCount(parseInt(e.target.value))} />
          </div>
        </div>
        <div className="speed-control">
          <label>Speed: {speed}</label>
          <input type="range" min="0.1" max="2" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} />
        </div>
        <div className="feature-controls">
          <label>
            <input type="checkbox" checked={powerUps} onChange={(e) => setPowerUps(e.target.checked)} />
            💣🛡️ Power-ups
          </label>
          <label>
            <input type="checkbox" checked={trails} onChange={(e) => setTrails(e.target.checked)} />
            ✨ Trails
          </label>
          <label>
            <input type="checkbox" checked={sounds} onChange={(e) => setSounds(e.target.checked)} />
            🔊 Sounds
          </label>
          <label>
            <input type="checkbox" checked={manualMode} onChange={(e) => setManualMode(e.target.checked)} />
            🎨 Manual Mode
          </label>
        </div>
        {manualMode && (
          <div className="manual-controls">
            <div className="type-selector">
              <button className={selectedType === 'rock' ? 'active' : ''} onClick={() => setSelectedType('rock')}>🪨</button>
              <button className={selectedType === 'paper' ? 'active' : ''} onClick={() => setSelectedType('paper')}>📄</button>
              <button className={selectedType === 'scissors' ? 'active' : ''} onClick={() => setSelectedType('scissors')}>✂️</button>
            </div>
            {isPlacing && <div className="instruction">Drag to place {selectedType} (bigger box = more particles)</div>}
            {isPlacing && <button className="start-btn" onClick={startSimulation}>▶️ Start</button>}
          </div>
        )}
        <div className="position-controls">
          <button className="save-btn" onClick={savePositions}>💾 Save</button>
          <button className="load-btn" onClick={loadPositions}>📁 Load</button>
        </div>
        <button className="reset-btn" onClick={init}>🔄 Reset</button>
        <div className="stream-controls">
          {!streaming ? 
            <button className="stream-btn" onClick={startStream}>🔴 Record</button> :
            <button className="stream-btn stop" onClick={stopStream}>⏹️ Stop</button>
          }
        </div>
        </>
        )}
      </div>
      <canvas 
        ref={canvasRef} 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{cursor: isPlacing ? 'crosshair' : 'default'}} 
      />
    </div>
  );
}

export default App;