import multer from "multer";
import slugify from "slugify";
import path from "path";

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "videos");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const name = slugify(base, {
      replacement: "-",
      remove: undefined,
      lower: true,
      strict: true,
      trim: true,
    });
    cb(null, `${Date.now()}_${name}${ext}`);
  },
});

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const name = slugify(base, {
      replacement: "-",
      remove: undefined,
      lower: true,
      strict: true,
      trim: true,
    });
    cb(null, `${Date.now()}_${name}${ext}`);
  },
});

export const saveVideo = multer({ storage: videoStorage });
export const saveImage = multer({ storage: imageStorage });
