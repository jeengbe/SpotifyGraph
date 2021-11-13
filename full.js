const TOKEN = "BQB5_2rt85eiUuRMDfzGF5voqoI3n-b5h263UpVPVnsyK6BVDHqeIdx0aTS27QI6pxiE5OEXsVX_K35IH46mHmTJow6A0LQTEJBJoUCijb7_grAoobZDah7WhWcOdnLqnkymYngujHRXdKrYEykTECJgOSHudBhNGDxQ5_7PwJm3dg4GJg-0pzchMPSAVihQiG2dXn99WLwYi-NvSFSlMsnfincipLuGx0x1flPLZS_Chr3wNsA0RIz-THOX671IGd3MXnusWvmsaj07Z9ODdGjmb1LuzQ";
const PLAYLIST = "https://open.spotify.com/playlist/6sj1OzIfTXMQMnvoWbPWAm?si=2b394e9e1f2f46b6";
// Find token here: https://developer.spotify.com/console/get-playlist-tracks/

const axios = require("axios");
const fs = require("fs");

function median(values) {
  values.sort(function (a, b) {
    return a - b;
  });

  var half = Math.floor(values.length / 2);

  if (values.length % 2) return values[half];

  return (values[half - 1] + values[half]) / 2.0;
}

function average(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

(async () => {
  const data = [];
  const playlistId = /^(?:https:\/\/open\.spotify\.com\/playlist\/)?(?<id>[a-z0-9]{22})(?:\?si=[a-z0-9]{16})?$/i.exec(PLAYLIST);
  if (!playlistId) {
    console.error("Invalid playlist id");
    process.exit(1);
  }


  let next = encodeURI(`https://api.spotify.com/v1/playlists/${playlistId.groups.id}/tracks?offset=0&limit=100&fields=next,total,items(added_at,is_local,track(id),type)`);
  let total;
  while (next !== null) {
    // Load songs
    let songs;
    try {
      songs = await axios.get(next, {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      });
    } catch (e) {
      console.log(e.message);
      if(e.response) console.log(e.response.data.error.message);
      process.exit(1);
    }
    next = songs.data.next;
    total = songs.data.total;
    console.log(`Fetched next ${songs.data.items.length} songs`);
    await new Promise(resolve => setTimeout(resolve, 333));

    // Get audio features
    const ids = songs.data.items.map(song => song.track.id);
    const features = await axios.get("https://api.spotify.com/v1/audio-features?ids=" + encodeURIComponent(ids.join(",")), {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });
    // Local songs are null
    data.push(...features.data.audio_features.filter(feature => feature !== null).map(({ danceability, energy, loudness, speechiness, acousticness, instrumentalness, liveness, valence, key, mode, tempo, id }, i) => ({ danceability, energy, loudness, speechiness, acousticness, instrumentalness, liveness, valence, key, mode, tempo, id, added_at: songs.data.items[i].added_at })));

    await new Promise(resolve => setTimeout(resolve, 333));
    console.log(`Loaded ${data.length} / ${total} audio features`);
  }

  console.log(`Loaded ${data.length} audio features`);
  console.log(`Skipped ${total - data.length} local songs`);

  // Generating statistics
  const method = average;

  // Aggregate months
  let stats = {};

  for (const song of data) {
    stats[song.added_at.slice(0, 7)] = stats[song.added_at.slice(0, 7)] || [];
    stats[song.added_at.slice(0, 7)].push(song);
  }

  stats = Object.entries(stats)
    .map(([month, songs]) => ({
      month,
      danceability: method(songs.map(song => song.danceability)),
      energy: method(songs.map(song => song.energy)),
      // loudness: method(songs.map(song => song.loudness)),
      speechiness: method(songs.map(song => song.speechiness)),
      acousticness: method(songs.map(song => song.acousticness)),
      instrumentalness: method(songs.map(song => song.instrumentalness)),
      liveness: method(songs.map(song => song.liveness)),
      valence: method(songs.map(song => song.valence))
      // key: method(songs.map(song => song.key)),
      // mode: method(songs.map(song => song.mode)),
      // tempo: method(songs.map(song => song.tempo)),

    }))
    .sort(({ month }, { month: month2 }) => month.localeCompare(month2));

  console.log(`Analysed ${stats.length} months`);

  fs.writeFileSync("data.csv", ["month", "danceability", "energy", "speechiness", "acousticness", "instrumentalness", "liveness", "valence"].join(",") + "\n" + stats.map(({ month, danceability, energy, speechiness, acousticness, instrumentalness, liveness, valence }) => [month, danceability, energy, speechiness, acousticness, instrumentalness, liveness, valence].join(",")).join("\n"));

  console.log("Wrote stats to data.csv");
})();
