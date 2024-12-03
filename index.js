const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Define quality levels with resolution and bitrate for ABR streaming
const qualities = [
  { label: '360p', width: 640, height: 360, bitrate: '800k' },
  { label: '480p', width: 854, height: 480, bitrate: '1200k' },
  { label: '720p', width: 1280, height: 720, bitrate: '2400k' },
  { label: '1080p', width: 1920, height: 1080, bitrate: '4500k' }
];

// Function to create renditions and M3U8 file
function createABRM3U8(videoPath, outputFolder) {
  // Ensure output folder exists
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
  }

  // Create promises for each quality level
  const renditions = qualities.map((quality) => {
    return new Promise((resolve, reject) => {
      const outputFilePath = path.join(outputFolder, `${quality.label}.m3u8`);
      ffmpeg(videoPath)
        .outputOptions([
          `-vf scale=${quality.width}:${quality.height}`,
          `-b:v ${quality.bitrate}`,
          '-c:a aac',
          '-ar 48000',
          '-c:v h264',
          '-preset veryfast',
          '-hls_time 6',       // Split each rendition into 6-second segments
          '-hls_playlist_type vod',
          `-hls_segment_filename ${outputFolder}/${quality.label}_%03d.ts`,
        ])
        .output(outputFilePath)
        .on('end', () => {
          console.log(`Created ${quality.label} rendition.`);
          resolve({ label: quality.label, path: `${quality.label}.m3u8`, bandwidth: quality.bitrate });
        })
        .on('error', (err) => {
          console.error(`Error creating ${quality.label} rendition:`, err);
          reject(err);
        })
        .run();
    });
  });

  // Create master playlist after all renditions are done
  Promise.all(renditions)
    .then((renditionData) => {
      const masterPlaylistPath = path.join(outputFolder, 'master.m3u8');
      const masterPlaylistContent = renditionData.map((rendition) => {
        return `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(rendition.bandwidth) * 1000},RESOLUTION=${qualities.find(q => q.label === rendition.label).width}x${qualities.find(q => q.label === rendition.label).height}\n${rendition.path}`;
      }).join('\n');

      fs.writeFileSync(masterPlaylistPath, `#EXTM3U\n${masterPlaylistContent}`);
      console.log('Master M3U8 playlist created:', masterPlaylistPath);
    })
    .catch((error) => {
      console.error('Error generating ABR M3U8 playlist:', error);
    });
}

// Example usage
const videoPath = path.join(__dirname, 'TenLIttleBabbies.mp4');  // Input video file path
const outputFolder = path.join(__dirname, 'TenLIttleBabbies');   // Output folder for HLS files

createABRM3U8(videoPath, outputFolder);






















