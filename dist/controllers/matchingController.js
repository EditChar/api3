"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMatchDetails = exports.checkMatchEligibility = exports.getMatches = void 0;
const database_1 = __importDefault(require("../config/database"));
/**
 * Kullanıcı için en uygun eşleşmeleri getirir
 * Kriterler:
 * - Karşı cinsten kullanıcılar
 * - En yakın toplam puan değerleri
 * - Rastgele 10 kullanıcı
 */
const getMatches = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(400).json({ message: 'User ID not found' });
    }
    try {
        // Önce kullanıcının kendi bilgilerini ve skorunu alalım
        const userResult = await database_1.default.query(`
      SELECT 
        u.id, u.gender,
        COALESCE(us.total_score, 0) as total_score,
        COALESCE(us.completed_tests_count, 0) as completed_tests_count
      FROM users u
      LEFT JOIN user_scores us ON u.id = us.user_id
      WHERE u.id = $1
    `, [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const currentUser = userResult.rows[0];
        // Kullanıcının tüm GÖRÜNÜR testleri tamamlayıp tamamlamadığını kontrol edelim
        const totalTestsResult = await database_1.default.query('SELECT COUNT(*) as total_count FROM tests WHERE deleted_at IS NULL AND is_visible = true');
        const totalTests = parseInt(totalTestsResult.rows[0].total_count);
        if (currentUser.completed_tests_count < totalTests) {
            return res.status(400).json({
                message: 'Eşleşme için tüm testleri tamamlamanız gerekiyor',
                completed_tests: currentUser.completed_tests_count,
                total_tests: totalTests
            });
        }
        // Karşı cinsten olanları belirleyelim
        let oppositeGender;
        if (currentUser.gender === 'male' || currentUser.gender === 'Male' || currentUser.gender === 'Erkek') {
            oppositeGender = ['female', 'Female', 'Kadın'];
        }
        else if (currentUser.gender === 'female' || currentUser.gender === 'Female' || currentUser.gender === 'Kadın') {
            oppositeGender = ['male', 'Male', 'Erkek'];
        }
        else {
            // Gender tanımlanmamışsa veya farklıysa, herkesi dahil et
            oppositeGender = ['male', 'Male', 'Erkek', 'female', 'Female', 'Kadın'];
        }
        // Potansiyel eşleşmeleri bul - karşı cinsten, tüm testleri tamamlamış, bloklanmamış kullanıcılar
        const potentialMatchesResult = await database_1.default.query(`
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.age, 
        u.residence_country, u.residence_city, u.gender, u.avatar_url,
        COALESCE(us.total_score, 0) as total_score,
        ABS(COALESCE(us.total_score, 0) - $1) as score_difference
      FROM users u
      LEFT JOIN user_scores us ON u.id = us.user_id
      WHERE u.id != $2 
        AND u.gender = ANY($3)
        AND COALESCE(us.completed_tests_count, 0) >= $4
        AND NOT EXISTS (
          SELECT 1 FROM blocked_users bu 
          WHERE (bu.blocker_id = $2 AND bu.blocked_id = u.id)
             OR (bu.blocker_id = u.id AND bu.blocked_id = $2)
        )
      ORDER BY score_difference ASC, RANDOM()
      LIMIT 10
    `, [currentUser.total_score, userId, oppositeGender, totalTests]);
        const matches = potentialMatchesResult.rows.map(match => ({
            id: match.id,
            username: match.username,
            first_name: match.first_name,
            last_name: match.last_name,
            age: match.age,
            residence_country: match.residence_country,
            residence_city: match.residence_city,
            gender: match.gender,
            avatar_url: match.avatar_url,
            total_score: match.total_score,
            score_difference: match.score_difference,
            compatibility_percentage: calculateCompatibility(match.score_difference)
        }));
        res.status(200).json({
            message: 'Eşleşmeler başarıyla getirildi',
            user_info: {
                total_score: currentUser.total_score,
                completed_tests: currentUser.completed_tests_count,
                total_available_tests: totalTests
            },
            matches: matches,
            matches_count: matches.length
        });
    }
    catch (error) {
        console.error('Get matches error:', error);
        res.status(500).json({ message: 'Eşleşmeler getirilirken hata oluştu' });
    }
};
exports.getMatches = getMatches;
/**
 * Puan farkına göre uyumluluk yüzdesi hesaplar
 */
function calculateCompatibility(scoreDifference) {
    // Maksimum puan farkını 1000 olarak varsayalım
    const maxScoreDifference = 1000;
    // Puan farkı ne kadar küçükse uyumluluk o kadar yüksek
    const compatibility = Math.max(0, 100 - (scoreDifference / maxScoreDifference) * 100);
    return Math.round(compatibility);
}
/**
 * Kullanıcının eşleşme için uygunluğunu kontrol eder
 */
const checkMatchEligibility = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(400).json({ message: 'User ID not found' });
    }
    try {
        // Kullanıcının test durumunu kontrol et
        const userTestStatusResult = await database_1.default.query(`
      SELECT 
        COALESCE(us.completed_tests_count, 0) as completed_tests,
        COALESCE(us.total_score, 0) as total_score
      FROM users u
      LEFT JOIN user_scores us ON u.id = us.user_id
      WHERE u.id = $1
    `, [userId]);
        const totalTestsResult = await database_1.default.query('SELECT COUNT(*) as total_count FROM tests WHERE deleted_at IS NULL AND is_visible = true');
        const totalTests = parseInt(totalTestsResult.rows[0].total_count);
        const userTestStatus = userTestStatusResult.rows[0];
        const isEligible = userTestStatus.completed_tests >= totalTests;
        res.status(200).json({
            is_eligible: isEligible,
            completed_tests: userTestStatus.completed_tests,
            total_tests: totalTests,
            remaining_tests: Math.max(0, totalTests - userTestStatus.completed_tests),
            total_score: userTestStatus.total_score,
            message: isEligible
                ? 'Eşleşme için uygunsunuz!'
                : `Eşleşme için ${totalTests - userTestStatus.completed_tests} test daha tamamlamanız gerekiyor.`
        });
    }
    catch (error) {
        console.error('Check eligibility error:', error);
        res.status(500).json({ message: 'Uygunluk kontrolü yapılırken hata oluştu' });
    }
};
exports.checkMatchEligibility = checkMatchEligibility;
/**
 * Belirli bir kullanıcının detaylarını getirir (eşleşme detayı için)
 */
const getMatchDetails = async (req, res) => {
    const userId = req.user?.id;
    const matchUserId = req.params.matchUserId;
    if (!userId) {
        return res.status(400).json({ message: 'User ID not found' });
    }
    if (!matchUserId) {
        return res.status(400).json({ message: 'Match user ID is required' });
    }
    try {
        // Önce blok kontrolü yap
        const blockCheckResult = await database_1.default.query(`
      SELECT 1 FROM blocked_users bu 
      WHERE (bu.blocker_id = $1 AND bu.blocked_id = $2)
         OR (bu.blocker_id = $2 AND bu.blocked_id = $1)
    `, [userId, matchUserId]);
        if (blockCheckResult.rows.length > 0) {
            return res.status(403).json({ message: 'Bu kullanıcı ile eşleşme detayları görüntülenemez' });
        }
        // Eşleşen kullanıcının detaylarını getir
        const matchResult = await database_1.default.query(`
      SELECT 
        u.id, u.username, u.first_name, u.last_name, u.age,
        u.residence_country, u.residence_city, u.gender, u.avatar_url,
        u.languages, u.height, u.weight,
        COALESCE(us.total_score, 0) as total_score,
        COALESCE(us.completed_tests_count, 0) as completed_tests_count
      FROM users u
      LEFT JOIN user_scores us ON u.id = us.user_id
      WHERE u.id = $1
    `, [matchUserId]);
        if (matchResult.rows.length === 0) {
            return res.status(404).json({ message: 'Eşleşen kullanıcı bulunamadı' });
        }
        // Mevcut kullanıcının skorunu da al
        const currentUserResult = await database_1.default.query(`
      SELECT COALESCE(us.total_score, 0) as total_score
      FROM users u
      LEFT JOIN user_scores us ON u.id = us.user_id
      WHERE u.id = $1
    `, [userId]);
        const currentUserScore = currentUserResult.rows[0]?.total_score || 0;
        const matchUser = matchResult.rows[0];
        const scoreDifference = Math.abs(matchUser.total_score - currentUserScore);
        res.status(200).json({
            match_user: {
                id: matchUser.id,
                username: matchUser.username,
                first_name: matchUser.first_name,
                last_name: matchUser.last_name,
                age: matchUser.age,
                residence_country: matchUser.residence_country,
                residence_city: matchUser.residence_city,
                gender: matchUser.gender,
                avatar_url: matchUser.avatar_url,
                languages: matchUser.languages,
                height: matchUser.height,
                weight: matchUser.weight,
                total_score: matchUser.total_score,
                completed_tests_count: matchUser.completed_tests_count
            },
            compatibility: {
                score_difference: scoreDifference,
                compatibility_percentage: calculateCompatibility(scoreDifference),
                your_score: currentUserScore
            }
        });
    }
    catch (error) {
        console.error('Get match details error:', error);
        res.status(500).json({ message: 'Eşleşme detayları getirilirken hata oluştu' });
    }
};
exports.getMatchDetails = getMatchDetails;
