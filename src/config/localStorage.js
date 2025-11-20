import multer from "multer";
import multerS3 from "multer-s3";

const s3Storage = multerS3({
  s3: s3,
  bucket: process.env.S3_BUCKET_NAME,
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function (req, file, cb) {
    const fileKey = `raw_videos/${Date.now()}_${file.originalname.replace(
      /\s+/g,
      "_"
    )}`;
    cb(null, fileKey);
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
});

const multerVideo = multer({storage:s3Storage})
export {multerVideo}