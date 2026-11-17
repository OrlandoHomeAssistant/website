'use strict';
const button = document.getElementById('porch-toggle');
const house = document.querySelector('.house-demo');
button.addEventListener('click', () => {
  const on = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(on));
  house.classList.toggle('lights-off', !on);
  document.getElementById('svg-state').textContent = on ? 'on' : 'off';
});
