import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Yükleme klasörünün var olup olmadığını kontrol et, yoksa oluştur
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Modern avatar sistemi için memory storage kullan
const storage = multer.memoryStorage();

// Dosya tipini kontrol eden filtre
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
        return cb(null, true);
    }
    cb(new Error('Hata: Sadece resim dosyaları (jpeg, jpg, png, gif) yüklenebilir!'));
};

// Multer middleware'ini yapılandır ve export et
const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5 MB dosya boyutu limiti
    fileFilter: fileFilter
});

export default upload; 