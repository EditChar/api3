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
// Modern avatar sistemi için memory storage kullan
const storage = multer_1.default.memoryStorage();
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
