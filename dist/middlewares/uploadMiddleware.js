"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Yükleme klasörünün var olup olmadığını kontrol et, yoksa oluştur
const uploadDir = path_1.default.join(__dirname, '..', '..', 'public', 'uploads', 'avatars');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Dosya depolama ayarları
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Dosya adının benzersiz olmasını sağlamak için tarih ve rastgele bir sayı ekliyoruz
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
// Dosya tipini kontrol eden filtre
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
        return cb(null, true);
    }
    cb(new Error('Hata: Sadece resim dosyaları (jpeg, jpg, png, gif) yüklenebilir!'));
};
// Multer middleware'ini yapılandır ve export et
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5 MB dosya boyutu limiti
    fileFilter: fileFilter
});
exports.default = upload;
