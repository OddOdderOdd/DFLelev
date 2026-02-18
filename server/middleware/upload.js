import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Temp upload directory
const TEMP_UPLOAD = path.join(process.cwd(), 'temp-uploads');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_UPLOAD)) {
  fs.mkdirSync(TEMP_UPLOAD, { recursive: true });
}

// Cleanup old temp files (older than 1 hour)
function cleanupTempFiles() {
  try {
    if (!fs.existsSync(TEMP_UPLOAD)) return;
    
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    fs.readdirSync(TEMP_UPLOAD).forEach(file => {
      const filePath = path.join(TEMP_UPLOAD, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > oneHour) {
        fs.unlinkSync(filePath);
        console.log(`🧹 Cleaned up old temp file: ${file}`);
      }
    });
  } catch (error) {
    console.error('Temp cleanup error:', error);
  }
}

// Run cleanup every 30 minutes
setInterval(cleanupTempFiles, 30 * 60 * 1000);
cleanupTempFiles(); // Run on startup

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TEMP_UPLOAD);
  },
  filename: function (req, file, cb) {
    // Preserve Danish characters and add timestamp for uniqueness
    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueName = `${Date.now()}-${filename}`;
    cb(null, uniqueName);
  }
});

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  }
});
