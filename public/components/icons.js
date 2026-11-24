const shapes={flower:'<g fill="none"><ellipse cy="7" cx="12" rx="3.2" ry="5"/><ellipse cy="7" cx="12" rx="3.2" ry="5" transform="rotate(72 12 12)"/><ellipse cy="7" cx="12" rx="3.2" ry="5" transform="rotate(144 12 12)"/><ellipse cy="7" cx="12" rx="3.2" ry="5" transform="rotate(216 12 12)"/><ellipse cy="7" cx="12" rx="3.2" ry="5" transform="rotate(288 12 12)"/></g><circle cx="12" cy="12" r="2.4" fill="currentColor"/>',bag:'<path d="M5 7h14l1 14H4L5 7Zm4 0V5a3 3 0 0 1 6 0v2"/>',sprig:'<path d="M4 21C13 15 14 9 19 3M8 17C3 17 3 12 3 11q7 0 7 4m2-5q-6-2-5-7 7 2 7 6m-2 5q7-6 10-3-3 6-11 6"/>',search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',heart:'<path d="M12 20S2 14 2 8.5C2 3 9 2 12 7c3-5 10-4 10 1.5C22 14 12 20 12 20Z"/>',plus:'<path d="M12 5v14M5 12h14"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',moon:'<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>'};
Object.assign(shapes, {
  bouquet:'<path d="m5 12 7 10 7-10-7 3zM12 15V8m-1 5L6 9m7 4 5-5"/><path d="M9 4c0-2 3-3 3-1 2-2 5 0 3 2 2 3-2 5-3 2-3 2-5-1-3-3z"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="6" r="2"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
  orders:'<path d="m3 7 9-4 9 4-9 5zM3 7v10l9 5 9-5V7m-9 5v10"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  bell:'<path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5zM10 20a2.3 2.3 0 0 0 4 0"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 6 0 0 1 16 0v2"/>'
});
export function icon(key){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+shapes[key]+'</svg>'}
