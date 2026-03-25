const btnCanvas = document.getElementById('btn-canvas');
const btnList = document.getElementById('btn-list');
const speedSlider = document.getElementById('speed-slider');
const viewCanvas = document.getElementById('view-canvas');
const viewList = document.getElementById('view-list');
const postList = document.getElementById('post-list');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const canvas = document.getElementById('bubble-canvas');
const ctx = canvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

let speedMultiplier = 4;
let nodes = [];
let draggedNode = null;
let hoverNode = null;
let snappedNode = null;
let mouse = { x: 0, y: 0 };
let isDragging = false;

class Node {
  constructor(filename) {
    this.filename = filename;
    this.title = filename.replace('.txt', '').replace(/-/g, ' ');
    this.radius = 80; // not randomized
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.baseVx = (Math.random() - 0.5) * 1.5;
    this.baseVy = (Math.random() - 0.5) * 1.5;
    this.vx = this.baseVx;
    this.vy = this.baseVy;
    this.color = '#2a2a35';
  }

  update() {
    if (snappedNode === this) {
      this.x += (width / 2 - this.x) * 0.08;
      this.y += (height / 2 - this.y) * 0.08;
      return;
    }
    
    if (draggedNode === this) {
      this.x = mouse.x;
      this.y = mouse.y;
      return;
    }

    this.x += this.vx * speedMultiplier;
    this.y += this.vy * speedMultiplier;

    const bound = 50;
    if (this.x < -bound) {
      this.x = -bound;
      this.vx = Math.abs(this.vx) * 0.9;
    }
    if (this.x > width + bound) {
      this.x = width + bound;
      this.vx = -Math.abs(this.vx) * 0.9;
    }
    if (this.y < -bound) {
      this.y = -bound;
      this.vy = Math.abs(this.vy) * 0.9;
    }
    if (this.y > height + bound) {
      this.y = height + bound;
      this.vy = -Math.abs(this.vy) * 0.9;
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = (this === hoverNode || this === snappedNode) ? '#3f3f4e' : this.color;
    ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '13px monospace';
    
    const words = this.title.split(' ');
    if (words.length > 1 && this.radius < 80) {
      ctx.fillText(words[0], this.x, this.y - 8);
      ctx.fillText(words.slice(1).join(' '), this.x, this.y + 10);
    } else {
      ctx.fillText(this.title, this.x, this.y);
    }
  }
}

function resolveNodeCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
  const minDist = a.radius + b.radius;
  if (dist >= minDist) return;

  const overlap = minDist - dist;
  const nx = dx / dist;
  const ny = dy / dist;

  // Push apart on overlap
  const push = overlap * 0.5;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;

  // Simple bounce physics horizontal component along normal
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const velAlongNormal = rvx * nx + rvy * ny;
  if (velAlongNormal > 0) return;

  const bounce = 0.99;
  const impulse = -(1 + bounce) * velAlongNormal / 2;
  const ix = impulse * nx;
  const iy = impulse * ny;

  a.vx -= ix;
  a.vy -= iy;
  b.vx += ix;
  b.vy += iy;
}

function resolveCollisions() {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      resolveNodeCollision(nodes[i], nodes[j]);
    }
  }
}

async function loadPostContent(filename) {
  try {
    const response = await fetch(`blog_entries/${filename}`);
    if (!response.ok) throw new Error('File not found');
    return await response.text();
  } catch (error) {
    return "Error loading content.";
  }
}

async function openModal(node) {
  modalTitle.textContent = node.title;
  modalBody.textContent = "Loading...";
  modal.classList.remove('hidden');
  
  const content = await loadPostContent(node.filename);
  modalBody.textContent = content;
}

speedSlider.addEventListener('input', (e) => {
  speedMultiplier = parseFloat(e.target.value) * 4;
});

btnCanvas.addEventListener('click', () => {
  viewCanvas.classList.remove('hidden');
  viewList.classList.add('hidden');
});

btnList.addEventListener('click', () => {
  viewList.classList.remove('hidden');
  viewCanvas.classList.add('hidden');
});

window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  
  if (draggedNode) {
    isDragging = true;
    return;
  }
  
  hoverNode = null;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const dx = mouse.x - node.x;
    const dy = mouse.y - node.y;
    if (Math.sqrt(dx * dx + dy * dy) < node.radius) {
      hoverNode = node;
      break;
    }
  }
  canvas.style.cursor = hoverNode ? 'pointer' : 'default';
});

canvas.addEventListener('mousedown', () => {
  if (hoverNode) {
    draggedNode = hoverNode;
    isDragging = false;
  }
});

canvas.addEventListener('mouseup', () => {
  if (draggedNode) {
    if (!isDragging && !snappedNode) {
      snappedNode = draggedNode;
      setTimeout(() => openModal(snappedNode), 400);
    }
    draggedNode = null;
    isDragging = false;
  }
});

modalClose.addEventListener('click', () => {
  modal.classList.add('hidden');
  snappedNode = null;
});

function animate() {
  ctx.clearRect(0, 0, width, height);
  nodes.forEach(node => node.update());
  resolveCollisions();
  nodes.forEach(node => node.draw());
  requestAnimationFrame(animate);
}

const fallbackFiles = [
  'test-post-1.txt',
  'test-post-2.txt',
  'test-post-3.txt'
];

async function init() {
  let files = [];
  try {
    const response = await fetch('blog-posts.json');
    files = await response.json();
  } catch (error) {
    files = fallbackFiles;
    console.warn('posts.json not found, using fallback blog entries.');
  }

  if (!Array.isArray(files) || files.length === 0) {
    modalTitle.textContent = "No posts available";
    modalBody.textContent = "No blog posts were found in posts.json or fallback entries.";
    modal.classList.remove('hidden');
    return;
  }

  files.sort((a, b) => a.localeCompare(b));

  files.forEach(filename => {
    const node = new Node(filename);
    nodes.push(node);
    
    const li = document.createElement('li');
    li.textContent = node.title;
    li.addEventListener('click', () => {
      snappedNode = node;
      openModal(node);
    });
    postList.appendChild(li);
  });

  animate();
}

init();