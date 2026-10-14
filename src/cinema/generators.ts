export interface FilmGenerator {
  readonly duration: number;
  draw(context: CanvasRenderingContext2D, time: number): void;
}

export type GeneratorFactory = (width: number, height: number) => FilmGenerator;

const TAU = Math.PI * 2;

function idle(width: number, height: number): FilmGenerator {
  return {
    duration: Infinity,
    draw(context, time) {
      const gradient = context.createRadialGradient(
        width / 2,
        height * 0.45,
        10,
        width / 2,
        height / 2,
        width * 0.6,
      );
      gradient.addColorStop(0, '#2a1d22');
      gradient.addColorStop(1, '#0b0909');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      context.textAlign = 'center';
      context.fillStyle = '#d9c39a';
      context.font = `500 ${String(height * 0.05)}px Inter, sans-serif`;
      context.fillText('N O W   S H O W I N G', width / 2, height * 0.36);
      context.fillStyle = '#f3ece0';
      context.font = `600 ${String(height * 0.17)}px "Cormorant Garamond", Georgia, serif`;
      context.fillText('The Little Cinema', width / 2, height * 0.56);
      context.globalAlpha = 0.55 + 0.35 * Math.sin(time * 2.2);
      context.fillStyle = '#d9c39a';
      context.font = `italic 500 ${String(height * 0.055)}px "Cormorant Garamond", Georgia, serif`;
      context.fillText('click the screen to choose a film', width / 2, height * 0.7);
      context.globalAlpha = 1;
    },
  };
}

function leader(width: number, height: number): FilmGenerator {
  return {
    duration: 9,
    draw(context, time) {
      const second = Math.floor(time % 9);
      const fraction = time % 1;
      if (second === 8) {
        context.fillStyle = fraction < 0.08 ? '#fff' : '#000';
        context.fillRect(0, 0, width, height);
        return;
      }
      context.fillStyle = '#8d8a84';
      context.fillRect(0, 0, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = height * 0.42;
      context.fillStyle = '#5d5a55';
      context.beginPath();
      context.moveTo(centerX, centerY);
      context.arc(centerX, centerY, width, -Math.PI / 2, -Math.PI / 2 + fraction * TAU);
      context.fill();
      context.strokeStyle = '#e9e6df';
      context.lineWidth = height * 0.012;
      for (const ring of [radius, radius * 0.85]) {
        context.beginPath();
        context.arc(centerX, centerY, ring, 0, TAU);
        context.stroke();
      }
      context.lineWidth = height * 0.006;
      context.beginPath();
      context.moveTo(0, centerY);
      context.lineTo(width, centerY);
      context.moveTo(centerX, 0);
      context.lineTo(centerX, height);
      context.stroke();
      context.fillStyle = '#111';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `600 ${String(height * 0.6)}px Georgia, serif`;
      context.fillText(String(8 - second), centerX, centerY + height * 0.03);
      context.textBaseline = 'alphabetic';
      grain(context, width, height, 0.07);
    },
  };
}

function bars(width: number, height: number): FilmGenerator {
  const top = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  return {
    duration: Infinity,
    draw(context, time) {
      const barWidth = width / top.length;
      top.forEach((color, index) => {
        context.fillStyle = color;
        context.fillRect(index * barWidth, 0, barWidth + 1, height * 0.67);
      });
      const middle = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
      middle.forEach((color, index) => {
        context.fillStyle = color;
        context.fillRect(index * barWidth, height * 0.67, barWidth + 1, height * 0.08);
      });
      context.fillStyle = '#101010';
      context.fillRect(0, height * 0.75, width, height * 0.25);
      const sweepX = ((time * 0.25) % 1) * width;
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.fillRect(sweepX, 0, width * 0.02, height * 0.75);
      context.fillStyle = '#eee';
      context.font = `500 ${String(height * 0.07)}px ui-monospace, Menlo, monospace`;
      context.textAlign = 'left';
      const seconds = Math.floor(time);
      const timestamp = [
        Math.floor(seconds / 3600),
        Math.floor(seconds / 60) % 60,
        seconds % 60,
        Math.floor((time % 1) * 24),
      ]
        .map((value) => String(value).padStart(2, '0'))
        .join(':');
      context.fillText(timestamp, width * 0.06, height * 0.9);
      context.textAlign = 'right';
      context.fillText('TEST PATTERN No. 5', width * 0.94, height * 0.9);
    },
  };
}

function aurora(width: number, height: number): FilmGenerator {
  return {
    duration: Infinity,
    draw(context, time) {
      const sky = context.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#02060f');
      sky.addColorStop(1, '#0a1626');
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      const hues = [150, 175, 280];
      hues.forEach((hue, index) => {
        context.beginPath();
        for (let x = 0; x <= width; x += 8) {
          const y =
            height * (0.35 + 0.08 * index) +
            Math.sin(x * 0.004 + time * (0.4 + index * 0.15) + index) * height * 0.08 +
            Math.sin(x * 0.011 - time * 0.7) * height * 0.03;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.lineTo(width, 0);
        context.lineTo(0, 0);
        context.closePath();
        const gradient = context.createLinearGradient(0, 0, 0, height * 0.6);
        gradient.addColorStop(0, `hsla(${String(hue)}, 90%, 50%, 0)`);
        gradient.addColorStop(1, `hsla(${String(hue)}, 90%, 55%, 0.35)`);
        context.fillStyle = gradient;
        context.fill();
      });
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = '#010204';
      context.beginPath();
      context.moveTo(0, height);
      for (let x = 0; x <= width; x += 20)
        context.lineTo(
          x,
          height * 0.8 -
            Math.abs(Math.sin(x * 0.006)) * height * 0.12 -
            Math.sin(x * 0.021) * height * 0.02,
        );
      context.lineTo(width, height);
      context.fill();
    },
  };
}

function starfield(width: number, height: number): FilmGenerator {
  const stars = Array.from({ length: 500 }, () => ({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: Math.random(),
  }));
  let last = 0;
  return {
    duration: Infinity,
    draw(context, time) {
      const delta = Math.min(0.1, Math.max(0, time - last));
      last = time;
      context.fillStyle = 'rgba(3, 4, 10, 0.35)';
      context.fillRect(0, 0, width, height);
      for (const star of stars) {
        star.z -= delta * 0.25;
        if (star.z <= 0.01) {
          star.x = Math.random() * 2 - 1;
          star.y = Math.random() * 2 - 1;
          star.z = 1;
        }
        const x = width / 2 + (star.x / star.z) * width * 0.3;
        const y = height / 2 + (star.y / star.z) * height * 0.3;
        const size = (1 - star.z) * 3.2;
        context.fillStyle = `rgba(220, 230, 255, ${String(1 - star.z)})`;
        context.fillRect(x, y, size, size);
      }
    },
  };
}

function grain(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
): void {
  context.fillStyle = `rgba(0,0,0,${String(amount)})`;
  for (let index = 0; index < 160; index += 1)
    context.fillRect(Math.random() * width, Math.random() * height, 2, 2);
  context.fillStyle = `rgba(255,255,255,${String(amount)})`;
  for (let index = 0; index < 2; index += 1)
    context.fillRect(Math.random() * width, 0, 1.5, height);
}

export const GENERATORS = { idle, leader, bars, aurora, starfield } satisfies Record<
  string,
  GeneratorFactory
>;
export type GeneratorName = keyof typeof GENERATORS;
