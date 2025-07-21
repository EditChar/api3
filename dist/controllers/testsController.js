"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTest = exports.toggleTestVisibility = exports.updateTest = exports.getTestById = exports.getAllTests = exports.createTest = void 0;
const database_1 = __importDefault(require("../config/database"));
// Yeni bir test seti oluşturma
const createTest = async (req, res) => {
    const { title, description } = req.body;
    const userId = req.user?.id; // authMiddleware'den gelen kullanıcı ID'si
    if (!title) {
        return res.status(400).json({ message: 'Test title is required' });
    }
    try {
        const result = await database_1.default.query('INSERT INTO tests (title, description, created_by) VALUES ($1, $2, $3) RETURNING id, title, description, created_by, created_at', [title, description || null, userId]);
        const newTest = result.rows[0];
        res.status(201).json({ ...newTest });
    }
    catch (error) {
        console.error('Error creating test:', error);
        res.status(500).json({ message: 'Error creating test' });
    }
};
exports.createTest = createTest;
// Tüm test setlerini listeleme (kullanıcının tamamladıkları hariç)
const getAllTests = async (req, res) => {
    const userId = req.user?.id;
    try {
        let query;
        let queryParams;
        if (userId) {
            // Kullanıcı giriş yapmışsa, tamamladığı testleri hariç tut ve sadece görünür testleri göster
            query = `
        SELECT t.*, u.username as creator_username 
        FROM tests t 
        LEFT JOIN users u ON t.created_by = u.id 
        LEFT JOIN user_test_responses utr ON t.id = utr.test_id AND utr.user_id = $1
        WHERE utr.test_id IS NULL AND t.deleted_at IS NULL AND (t.is_visible = true OR $2 = true)
        ORDER BY t.created_at DESC
      `;
            // Admin rolü kontrolü: admin ise tüm testleri göster, değilse sadece görünür olanları
            const isAdmin = req.user?.role === 'admin';
            queryParams = [userId, isAdmin];
        }
        else {
            // Kullanıcı giriş yapmamışsa, sadece görünür testleri göster
            query = `
        SELECT t.*, u.username as creator_username 
        FROM tests t 
        LEFT JOIN users u ON t.created_by = u.id 
        WHERE t.deleted_at IS NULL AND t.is_visible = true
        ORDER BY t.created_at DESC
      `;
            queryParams = [];
        }
        const result = await database_1.default.query(query, queryParams);
        const tests = result.rows.map(row => ({
            ...row,
            description: row.description,
            creator: row.creator_username ? { username: row.creator_username, id: row.created_by } : null
        }));
        res.status(200).json(tests);
    }
    catch (error) {
        console.error('Error fetching tests:', error);
        res.status(500).json({ message: 'Error fetching tests' });
    }
};
exports.getAllTests = getAllTests;
// ID ile tek bir test setini getirme (sorularıyla birlikte)
const getTestById = async (req, res) => {
    const { testId } = req.params;
    try {
        const testResult = await database_1.default.query('SELECT t.*, u.username as creator_username FROM tests t LEFT JOIN users u ON t.created_by = u.id WHERE t.id = $1', [testId]);
        if (testResult.rows.length === 0) {
            return res.status(404).json({ message: 'Test not found' });
        }
        const test = {
            ...testResult.rows[0],
            description: testResult.rows[0].description,
            creator: testResult.rows[0].creator_username ? { username: testResult.rows[0].creator_username, id: testResult.rows[0].created_by } : null
        };
        // Bu teste ait soruları çek
        const questionsResult = await database_1.default.query('SELECT * FROM questions WHERE test_id = $1 ORDER BY id ASC', [testId]);
        test.questions = questionsResult.rows;
        // Her bir sorunun cevaplarını çek (N+1 problemine dikkat, büyük veri setlerinde optimize edilebilir)
        if (test.questions) {
            for (const question of test.questions) {
                const answersResult = await database_1.default.query('SELECT * FROM answers WHERE question_id = $1 ORDER BY id ASC', [question.id]);
                question.answers = answersResult.rows;
            }
        }
        const safeTest = {
            ...test,
            questions: test.questions?.map(q => ({
                ...q,
                answers: q.answers?.map(a => ({ ...a }))
            }))
        };
        res.status(200).json(safeTest);
    }
    catch (error) {
        console.error('Error fetching test details:', error);
        res.status(500).json({ message: 'Error fetching test details' });
    }
};
exports.getTestById = getTestById;
// Bir test setini güncelleme
const updateTest = async (req, res) => {
    const { testId } = req.params;
    const { title, description } = req.body;
    const userId = req.user?.id;
    if (!title) {
        return res.status(400).json({ message: 'Test title is required' });
    }
    try {
        // Sadece testi oluşturan kişi güncelleyebilsin kontrolü eklenebilir
        const checkOwnership = await database_1.default.query('SELECT created_by FROM tests WHERE id = $1', [testId]);
        if (checkOwnership.rows.length === 0) {
            return res.status(404).json({ message: 'Test not found' });
        }
        // if (checkOwnership.rows[0].created_by !== userId && req.user?.role !== 'admin') { // Admin her zaman güncelleyebilir
        //     return res.status(403).json({ message: 'Forbidden: You can only update your own tests' });
        // }
        const result = await database_1.default.query('UPDATE tests SET title = $1, description = $2 WHERE id = $3 RETURNING id, title, description, created_by, created_at', [title, description || null, testId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Test not found or not updated' });
        }
        res.status(200).json({ ...result.rows[0] });
    }
    catch (error) {
        console.error('Error updating test:', error);
        res.status(500).json({ message: 'Error updating test' });
    }
};
exports.updateTest = updateTest;
// Test görünürlüğünü değiştirme (gizle/göster)
const toggleTestVisibility = async (req, res) => {
    const { testId } = req.params;
    const userId = req.user?.id;
    try {
        // Mevcut görünürlük durumunu al
        const currentTest = await database_1.default.query('SELECT is_visible FROM tests WHERE id = $1', [testId]);
        if (currentTest.rows.length === 0) {
            return res.status(404).json({ message: 'Test not found' });
        }
        // Görünürlük durumunu tersine çevir
        const newVisibility = !currentTest.rows[0].is_visible;
        const result = await database_1.default.query('UPDATE tests SET is_visible = $1 WHERE id = $2 RETURNING id, title, is_visible', [newVisibility, testId]);
        res.status(200).json({
            message: newVisibility ? 'Test successfully made visible' : 'Test successfully hidden',
            test: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error toggling test visibility:', error);
        res.status(500).json({ message: 'Error toggling test visibility' });
    }
};
exports.toggleTestVisibility = toggleTestVisibility;
// Bir test setini silme (bağlı tüm kayıtlarla birlikte)
const deleteTest = async (req, res) => {
    const { testId } = req.params;
    const client = await database_1.default.connect();
    try {
        console.log(`Attempting to delete test with ID: ${testId} and all related data.`);
        await client.query('BEGIN');
        // Teste ait soruların ID'lerini al
        const questionsResult = await client.query('SELECT id FROM questions WHERE test_id = $1', [testId]);
        const questionIds = questionsResult.rows.map(q => q.id);
        console.log(`Found ${questionIds.length} questions for test ${testId}:`, questionIds);
        if (questionIds.length > 0) {
            const questionIdPlaceholders = questionIds.map((_, i) => `$${i + 1}`).join(',');
            // 1. user_question_responses tablosundan ilgili kayıtları sil
            const deleteUserQuestionResponsesResult = await client.query(`DELETE FROM user_question_responses WHERE question_id IN (${questionIdPlaceholders})`, questionIds);
            console.log(`Deleted ${deleteUserQuestionResponsesResult.rowCount} user_question_responses.`);
            // 2. answers tablosundan ilgili cevapları sil
            const deleteAnswersResult = await client.query(`DELETE FROM answers WHERE question_id IN (${questionIdPlaceholders})`, questionIds);
            console.log(`Deleted ${deleteAnswersResult.rowCount} answers.`);
        }
        // 3. user_test_responses tablosundan ilgili kayıtları sil
        const deleteUserTestResponsesResult = await client.query('DELETE FROM user_test_responses WHERE test_id = $1', [testId]);
        console.log(`Deleted ${deleteUserTestResponsesResult.rowCount} user_test_responses.`);
        // 4. questions tablosundan soruları sil
        const deleteQuestionsResult = await client.query('DELETE FROM questions WHERE test_id = $1', [testId]);
        console.log(`Deleted ${deleteQuestionsResult.rowCount} questions.`);
        // 5. Son olarak testin kendisini sil
        const deleteTestResult = await client.query('DELETE FROM tests WHERE id = $1 RETURNING *', [testId]);
        console.log(`Deleted ${deleteTestResult.rowCount} test.`);
        if (deleteTestResult.rowCount === 0) {
            await client.query('ROLLBACK');
            console.log(`Test with ID ${testId} not found during final delete step.`);
            return res.status(404).json({ message: 'Test not found' });
        }
        await client.query('COMMIT');
        console.log(`Test ${testId} and all related data successfully deleted.`);
        res.status(200).json({ message: 'Test and all related data deleted successfully' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error deleting test ID ${testId}:`, error);
        res.status(500).json({
            message: 'Error deleting test',
            error: error.message
        });
    }
    finally {
        client.release();
    }
};
exports.deleteTest = deleteTest;
