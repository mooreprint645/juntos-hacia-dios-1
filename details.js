const DetailModule = window.JHD || {};
window.JHD = DetailModule;
DetailModule.NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
DetailModule.FLATS = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
DetailModule.rootNote = (value) => {
  const found = String(value || "").match(/[A-G](?:#|b)?/);
  return found ? found[0] : "";
};
DetailModule.noteIndex = (note) => DetailModule.NOTES.indexOf(DetailModule.FLATS[String(note || "")] || String(note || ""));
DetailModule.transposeChord = (chord, steps) => String(chord || "").replace(/^([A-G](?:#|b)?)(.*)$/, (_, root, rest) => {
  const index = DetailModule.noteIndex(root);
  if (index < 0) return chord;
  const next = DetailModule.NOTES[(index + Number(steps || 0) + 120) % 12];
  return next + String(rest || "").replace(/\/([A-G](?:#|b)?)/g, (match, bass) => {
    const bassIndex = DetailModule.noteIndex(bass);
    return bassIndex < 0 ? match : `/${DetailModule.NOTES[(bassIndex + Number(steps || 0) + 120) % 12]}`;
  });
});
DetailModule.transposeGroup = (value, steps) => String(value || "").replace(/[A-G](?:#|b)?[a-zA-Z0-9#b+\-susmajdimaug/()]*/g, (chord) => DetailModule.transposeChord(chord, steps));
DetailModule.renderChordLyrics = (lyrics, steps) => String(lyrics || "").split("\n").map((line) => {
  if (!line.trim()) return `<span class="song-empty-line"></span>`;
  const section = line.trim().match(/^\[([^\]]+)\]$/);
  if (section) return `<span class="song-section-label">${DetailModule.esc(section[1])}</span>`;
  if (!line.includes("(")) return `<span class="song-plain-line">${DetailModule.esc(line)}</span>`;
  let chordLine = "", lyricLine = "", lyricPosition = 0, lastIndex = 0, match;
  const regex = /\(([^)]+)\)/g;
  while ((match = regex.exec(line)) !== null) {
    const before = line.slice(lastIndex, match.index);
    lyricLine += before;
    lyricPosition += before.length;
    while (chordLine.length < lyricPosition) chordLine += " ";
    chordLine += DetailModule.transposeGroup(match[1], steps);
    lastIndex = regex.lastIndex;
  }
  lyricLine += line.slice(lastIndex);
  return `<span class="song-line"><span class="chord-line">${DetailModule.esc(chordLine)}</span><span class="lyric-line">${DetailModule.esc(lyricLine)}</span></span>`;
}).join("");
