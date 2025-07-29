"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTestCompletion = exports.getCompletedTests = exports.getTestResponseDetails = exports.getUserScore = exports.getUserTestResponses = exports.submitTestResponse = void 0;
const database_1 = __importDefault(require("../config/database"));
// Kullanıcının teste verdiği cevapları kaydetme ve puanlama
const submitTestResponse = async (req, res) => {
    const { testId } = req.params;
    const { responses } = req.body; // responses: [{question_id: number, answer_id: number}, ...]
    const userId = req.user?.id;
    if (!responses || !Array.isArray(responses) || responses.length === 0) {
        return res.status(400).json({ message: 'Test responses are required.' });
    }
    // Cevapların geçerliliğini kontrol et
    for (const response of responses) {
        if (!response.question_id || !response.answer_id) {
            return res.status(400).json({ message: 'Each response must have question_id and answer_id.' });
        }
    }
    const client = await database_1.default.connect();
    try {
        await client.query('BEGIN');
        // Kullanıcının bu testi daha önce tamamlayıp tamamlamadığını kontrol et
        const existingResponse = await client.query('SELECT id FROM user_test_responses WHERE user_id = $1 AND test_id = $2', [userId, testId]);
        if (existingResponse.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                message: 'Bu test daha önce tamamlanmış.',
                alreadyCompleted: true
            });
        }
        let totalTestScore = 0;
        const questionResponses = [];
        // Her cevap için puanı hesapla ve kaydet
        for (const response of responses) {
            // Cevabın puanını al
            const scoreQuery = await client.query('SELECT score FROM answers WHERE id = $1 AND question_id = $2', [response.answer_id, response.question_id]);
            if (scoreQuery.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    message: `Invalid answer_id ${response.answer_id} for question_id ${response.question_id}`
                });
            }
            const answerScore = scoreQuery.rows[0].score;
            totalTestScore += answerScore;
            // Kullanıcının cevabını kaydet
            const questionResponseResult = await client.query('INSERT INTO user_question_responses (user_id, question_id, answer_id, response_score) VALUES ($1, $2, $3, $4) RETURNING *', [userId, response.question_id, response.answer_id, answerScore]);
            questionResponses.push(questionResponseResult.rows[0]);
        }
        // Test sonucunu kaydet
        const testResponseResult = await client.query('INSERT INTO user_test_responses (user_id, test_id, test_score) VALUES ($1, $2, $3) RETURNING *', [userId, testId, totalTestScore]);
        const testResponse = testResponseResult.rows[0];
        // Kullanıcının genel puanını güncelle
        if (userId) {
            await updateUserScore(client, userId);
        }
        await client.query('COMMIT');
        res.status(201).json({
            testResponse: { ...testResponse },
            questionResponses: questionResponses.map(qr => ({ ...qr })),
            totalScore: totalTestScore
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting test response:', error);
        res.status(500).json({ message: 'Error submitting test response' });
    }
    finally {
        client.release();
    }
};
exports.submitTestResponse = submitTestResponse;
// Kullanıcının genel puanını güncelleme helper fonksiyonu
const updateUserScore = async (client, userId) => {
    // Kullanıcının toplam puanını ve tamamladığı GÖRÜNÜR test sayısını hesapla
    const userStatsQuery = await client.query(`SELECT COUNT(*) as completed_tests, COALESCE(SUM(utr.test_score), 0) as total_score 
     FROM user_test_responses utr
     JOIN tests t ON utr.test_id = t.id
     WHERE utr.user_id = $1 AND t.deleted_at IS NULL AND t.is_visible = true`, [userId]);
    const { completed_tests, total_score } = userStatsQuery.rows[0];
    // user_scores tablosunu güncelle veya oluştur
    await client.query(`INSERT INTO user_scores (user_id, total_score, completed_tests_count, last_updated) 
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET 
     total_score = EXCLUDED.total_score,
     completed_tests_count = EXCLUDED.completed_tests_count,
     last_updated = CURRENT_TIMESTAMP`, [userId, total_score, completed_tests]);
};
// Kullanıcının test sonuçlarını listeleme
const getUserTestResponses = async (req, res) => {
    const userId = req.user?.id;
    const { page = 1, limit = 10 } = req.query;
    try {
        const offset = (Number(page) - 1) * Number(limit);
        const result = await database_1.default.query(`SELECT utr.*, t.title as test_title, t.description as test_description
       FROM user_test_responses utr
       JOIN tests t ON utr.test_id = t.id
       WHERE utr.user_id = $1
       ORDER BY utr.completed_at DESC
       LIMIT $2 OFFSET $3`, [userId, limit, offset]);
        // Toplam sayıyı al
        const countResult = await database_1.default.query('SELECT COUNT(*) FROM user_test_responses WHERE user_id = $1', [userId]);
        res.status(200).json({
            testResponses: result.rows.map(tr => ({ ...tr })),
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(Number(countResult.rows[0].count) / Number(limit)),
                totalCount: Number(countResult.rows[0].count)
            }
        });
    }
    catch (error) {
        console.error('Error fetching user test responses:', error);
        res.status(500).json({ message: 'Error fetching user test responses' });
    }
};
exports.getUserTestResponses = getUserTestResponses;
// Kullanıcının genel puanını alma
const getUserScore = async (req, res) => {
    const userId = req.user?.id;
    try {
        const result = await database_1.default.query('SELECT * FROM user_scores WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(200).json({
                user_id: userId,
                total_score: 0,
                completed_tests_count: 0,
                last_updated: null
            });
        }
        res.status(200).json({ ...result.rows[0] });
    }
    catch (error) {
        console.error('Error fetching user score:', error);
        res.status(500).json({ message: 'Error fetching user score' });
    }
};
exports.getUserScore = getUserScore;
// Belirli bir testin detaylı sonuçlarını alma
const getTestResponseDetails = async (req, res) => {
    const { testResponseId } = req.params;
    const userId = req.user?.id;
    try {
        // Test yanıtının varlığını ve kullanıcıya ait olduğunu kontrol et
        const testResponseResult = await database_1.default.query(`SELECT utr.*, t.title as test_title 
       FROM user_test_responses utr
       JOIN tests t ON utr.test_id = t.id
       WHERE utr.id = $1 AND utr.user_id = $2`, [testResponseId, userId]);
        if (testResponseResult.rows.length === 0) {
            return res.status(404).json({ message: 'Test response not found' });
        }
        const testResponse = testResponseResult.rows[0];
        // Bu test için kullanıcının verdiği tüm cevapları al
        const questionResponsesResult = await database_1.default.query(`SELECT uqr.*, q.question_text, a.answer_text
       FROM user_question_responses uqr
       JOIN questions q ON uqr.question_id = q.id
       JOIN answers a ON uqr.answer_id = a.id
       WHERE uqr.user_id = $1 AND q.test_id = $2
       ORDER BY q.id`, [userId, testResponse.test_id]);
        res.status(200).json({
            testResponse: { ...testResponse },
            questionResponses: questionResponsesResult.rows.map(qr => ({ ...qr }))
        });
    }
    catch (error) {
        console.error('Error fetching test response details:', error);
        res.status(500).json({ message: 'Error fetching test response details' });
    }
};
exports.getTestResponseDetails = getTestResponseDetails;
// Kullanıcının tamamladığı testleri listeleme
const getCompletedTests = async (req, res) => {
    const userId = req.user?.id;
    const { page = 1, limit = 10 } = req.query;
    try {
        const offset = (Number(page) - 1) * Number(limit);
        const result = await database_1.default.query(`SELECT utr.*, t.title as test_title, t.description as test_description,
              u.username as creator_username
       FROM user_test_responses utr
       JOIN tests t ON utr.test_id = t.id
       LEFT JOIN users u ON t.created_by = u.id
       WHERE utr.user_id = $1
       ORDER BY utr.completed_at DESC
       LIMIT $2 OFFSET $3`, [userId, limit, offset]);
        // Toplam sayıyı al
        const countResult = await database_1.default.query('SELECT COUNT(*) FROM user_test_responses WHERE user_id = $1', [userId]);
        res.status(200).json({
            completedTests: result.rows.map(ct => ({ ...ct })),
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(Number(countResult.rows[0].count) / Number(limit)),
                totalCount: Number(countResult.rows[0].count)
            }
        });
    }
    catch (error) {
        console.error('Error fetching completed tests:', error);
        res.status(500).json({ message: 'Error fetching completed tests' });
    }
};
exports.getCompletedTests = getCompletedTests;
// Kullanıcının bir testi tamamlayıp tamamlamadığını kontrol etme
const checkTestCompletion = async (req, res) => {
    const { testId } = req.params;
    const userId = req.user?.id;
    try {
        const result = await database_1.default.query('SELECT id, test_score, completed_at FROM user_test_responses WHERE user_id = $1 AND test_id = $2', [userId, testId]);
        if (result.rows.length > 0) {
            res.status(200).json({
                completed: true,
                completionData: { ...result.rows[0] }
            });
        }
        else {
            res.status(200).json({
                completed: false
            });
        }
    }
    catch (error) {
        console.error('Error checking test completion:', error);
        res.status(500).json({ message: 'Error checking test completion' });
    }
};
exports.checkTestCompletion = checkTestCompletion;
