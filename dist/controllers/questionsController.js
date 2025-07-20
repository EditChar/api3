"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteQuestion = exports.updateQuestion = exports.getQuestionById = exports.getQuestionsForTest = exports.addQuestionToTest = void 0;
const database_1 = __importDefault(require("../config/database"));
// Bir test setine yeni bir soru ve cevaplarını ekleme
const addQuestionToTest = async (req, res) => {
    const { testId } = req.params; // URL'den test ID'sini al
    const { question_text, answers } = req.body; // answers: [{ answer_text: string, score: number }, ...]
    const userId = req.user?.id;
    if (!question_text || !answers || !Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ message: 'Question text and at least one answer are required.' });
    }
    // Cevap sayısı için kesin bir kural (örn: 5) isteniyorsa, answers.length !== 5 kontrolü eklenebilir.
    for (const ans of answers) {
        if (!ans.answer_text || typeof ans.answer_text !== 'string' || ans.answer_text.trim() === '') {
            return res.status(400).json({ message: 'Each answer must have a non-empty answer_text string.' });
        }
        if (ans.score === undefined || typeof ans.score !== 'number' || ans.score < 1 || ans.score > 5) {
            return res.status(400).json({ message: 'Each answer must have a score (number) between 1 and 5.' });
        }
    }
    // İsteğe bağlı: Sadece testi oluşturan kişinin soru ekleyebilmesi kontrolü
    // const testOwnerCheck = await pool.query('SELECT created_by FROM tests WHERE id = $1', [testId]);
    // if (testOwnerCheck.rows.length === 0) {
    //     return res.status(404).json({ message: 'Parent test not found.' });
    // }
    // if (testOwnerCheck.rows[0].created_by !== userId && req.user?.role !== 'admin') {
    //     return res.status(403).json({ message: 'Forbidden: You can only add questions to your own tests.' });
    // }
    const client = await database_1.default.connect();
    try {
        await client.query('BEGIN');
        const questionResult = await client.query('INSERT INTO questions (test_id, question_text) VALUES ($1, $2) RETURNING id, test_id, question_text, created_at', [testId, question_text]);
        const newQuestion = questionResult.rows[0];
        const createdAnswers = [];
        if (newQuestion.id) {
            for (const ans of answers) {
                const answerResult = await client.query('INSERT INTO answers (question_id, answer_text, score) VALUES ($1, $2, $3) RETURNING id, question_id, answer_text, score, created_at', [newQuestion.id, ans.answer_text, ans.score]);
                createdAnswers.push(answerResult.rows[0]);
            }
        }
        await client.query('COMMIT');
        res.status(201).json({ ...newQuestion, answers: createdAnswers.map(a => ({ ...a })) });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding question to test:', error);
        res.status(500).json({ message: 'Error adding question to test' });
    }
    finally {
        client.release();
    }
};
exports.addQuestionToTest = addQuestionToTest;
// Bir test setindeki tüm soruları listeleme (cevaplarıyla birlikte)
const getQuestionsForTest = async (req, res) => {
    const { testId } = req.params;
    try {
        const questionsResult = await database_1.default.query('SELECT * FROM questions WHERE test_id = $1 ORDER BY id ASC', [testId]);
        const questions = questionsResult.rows;
        for (const question of questions) {
            const answersResult = await database_1.default.query('SELECT * FROM answers WHERE question_id = $1 ORDER BY id ASC', [question.id]);
            question.answers = answersResult.rows;
        }
        const safeQuestions = questions.map(q => ({ ...q, answers: q.answers?.map(a => ({ ...a })) ?? [] }));
        res.status(200).json(safeQuestions);
    }
    catch (error) {
        console.error('Error fetching questions for test:', error);
        res.status(500).json({ message: 'Error fetching questions for test' });
    }
};
exports.getQuestionsForTest = getQuestionsForTest;
// Tek bir soruyu ID ile getirme (cevaplarıyla birlikte)
const getQuestionById = async (req, res) => {
    const { questionId } = req.params;
    try {
        const questionResult = await database_1.default.query('SELECT * FROM questions WHERE id = $1', [questionId]);
        if (questionResult.rows.length === 0) {
            return res.status(404).json({ message: 'Question not found' });
        }
        const question = questionResult.rows[0];
        const answersResult = await database_1.default.query('SELECT * FROM answers WHERE question_id = $1 ORDER BY id ASC', [questionId]);
        question.answers = answersResult.rows;
        const safeQuestion = { ...question, answers: question.answers.map(a => ({ ...a })) };
        res.status(200).json(safeQuestion);
    }
    catch (error) {
        console.error('Error fetching question:', error);
        res.status(500).json({ message: 'Error fetching question' });
    }
};
exports.getQuestionById = getQuestionById;
// Bir soruyu güncelleme (Soru metni VE CEVAPLARI ile birlikte)
const updateQuestion = async (req, res) => {
    const { questionId } = req.params;
    const { question_text, answers } = req.body;
    // const userId = req.user?.id; // Yetkilendirme için gerekirse
    if (!question_text || !answers || !Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ message: 'Question text and at least one answer are required.' });
    }
    for (const ans of answers) {
        if (!ans.answer_text || typeof ans.answer_text !== 'string' || ans.answer_text.trim() === '') {
            return res.status(400).json({ message: 'Each answer must have a non-empty answer_text string.' });
        }
        if (ans.score === undefined || typeof ans.score !== 'number' || ans.score < 1 || ans.score > 5) {
            return res.status(400).json({ message: 'Each answer must have a score (number) between 1 and 5.' });
        }
    }
    const client = await database_1.default.connect();
    try {
        await client.query('BEGIN');
        // 1. Soru metnini güncelle
        const updatedQuestionResult = await client.query('UPDATE questions SET question_text = $1 WHERE id = $2 RETURNING id, test_id, question_text, created_at', [question_text, questionId]);
        if (updatedQuestionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Question not found' });
        }
        const updatedQuestion = updatedQuestionResult.rows[0];
        const incomingAnswerIds = [];
        const finalAnswers = [];
        // 2. Mevcut cevapları güncelle veya yeni cevapları ekle
        for (const ans of answers) {
            if (ans.id) { // Mevcut cevap, güncelle
                const updatedAnswerResult = await client.query('UPDATE answers SET answer_text = $1, score = $2 WHERE id = $3 AND question_id = $4 RETURNING id, question_id, answer_text, score, created_at', [ans.answer_text, ans.score, ans.id, questionId]);
                if (updatedAnswerResult.rows.length > 0) {
                    finalAnswers.push(updatedAnswerResult.rows[0]);
                    incomingAnswerIds.push(ans.id);
                }
                else {
                    // Güncellenmek istenen cevap bulunamadı veya başka bir soruya ait.
                    // Bu durumu nasıl ele alacağımıza karar vermeliyiz. Şimdilik hata vermeyelim, devam edelim.
                    // Belki de bu cevap yeni olarak eklenmeliydi (ID'si yanlışsa vs.)
                    console.warn(`Answer with id ${ans.id} not found for question ${questionId} during update.`);
                }
            }
            else { // Yeni cevap, ekle
                const insertedAnswerResult = await client.query('INSERT INTO answers (question_id, answer_text, score) VALUES ($1, $2, $3) RETURNING id, question_id, answer_text, score, created_at', [questionId, ans.answer_text, ans.score]);
                finalAnswers.push(insertedAnswerResult.rows[0]);
                if (insertedAnswerResult.rows[0].id)
                    incomingAnswerIds.push(insertedAnswerResult.rows[0].id);
            }
        }
        // 3. Eski (frontend'den gelmeyen) cevapları sil
        // incomingAnswerIds boşsa ve answers dizisi doluysa, hepsi yeni eklenmiş demektir, silme işlemi yapma.
        // Eğer answers boşsa (ki bu durumu başta kontrol ettik, en az 1 cevap olmalı), bu kısım çalışmayacak.
        if (incomingAnswerIds.length > 0) {
            const placeholders = incomingAnswerIds.map((_, i) => `$${i + 2}`).join(','); // $2, $3, ...
            await client.query(`DELETE FROM answers WHERE question_id = $1 AND id NOT IN (${placeholders})`, [questionId, ...incomingAnswerIds]);
        }
        else if (answers.length > 0 && incomingAnswerIds.length === 0) {
            // Bu durum, tüm cevapların yeni olduğu anlamına gelir.
            // Bu durumda, o soruya ait veritabanındaki tüm eski cevaplar silinmelidir.
            // (Eğer gelen cevaplar içinde ID yoksa, bu mevcut tüm cevapların silinip yenilerinin eklendiği anlamına gelir)
            // Ancak, frontend'den gelen answer objelerinde ID varsa ve hiçbirisi DB'de yoksa yukarıdaki `else` bloğuna girer.
            // Bu mantık biraz daha dikkatli kurulmalı. Şimdilik eğer tüm gelen cevaplar ID'siz ise, eski olanları silelim.
            let allNewAnswers = true;
            for (const ans of answers) {
                if (ans.id) {
                    allNewAnswers = false;
                    break;
                }
            }
            if (allNewAnswers) {
                await client.query(`DELETE FROM answers WHERE question_id = $1`, [questionId]);
                // Yeniden ekleme zaten yukarıdaki loop'ta yapıldı.
            }
            // Eğer bazıları ID'li, bazıları ID'siz ise ve ID'liler DB'de yoksa ne olacak?
            // Bu senaryoyu daha sağlam hale getirmek için, belki de önce tüm eski cevapları silip
            // sonra gelen tüm cevapları (ID'lerine bakmaksızın) yeni olarak eklemek daha basit ve güvenli olabilir.
            // Ya da frontend, silinecek cevapların ID'lerini ayrıca gönderebilir.
            // Şimdiki yaklaşım: Gelen ID'lileri güncelle, ID'sizleri ekle, listede olmayan ID'lileri sil.
        }
        await client.query('COMMIT');
        // Güncellenmiş soruyu ve güncel cevap listesini döndür
        // finalAnswers listesi, yapılan işlemlere göre güncel cevapları içermeli.
        // Silinenler burada olmayacak, güncellenenler ve yeni eklenenler olacak.
        // Tam listeyi almak için tekrar DB'den çekebiliriz:
        const currentAnswersResult = await client.query('SELECT * FROM answers WHERE question_id = $1 ORDER BY id ASC', [questionId]);
        updatedQuestion.answers = currentAnswersResult.rows;
        const safeUpdatedQuestion = { ...updatedQuestion, answers: updatedQuestion.answers.map(a => ({ ...a })) };
        res.status(200).json(safeUpdatedQuestion);
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating question with answers:', error);
        res.status(500).json({ message: 'Error updating question with answers' });
    }
    finally {
        client.release();
    }
};
exports.updateQuestion = updateQuestion;
// Bir soruyu silme (bağlı cevaplar ve kullanıcı yanıtları da silinecek)
const deleteQuestion = async (req, res) => {
    const { questionId } = req.params;
    const client = await database_1.default.connect();
    try {
        console.log(`Attempting to delete question with ID: ${questionId} and all related data.`);
        await client.query('BEGIN');
        // 1. Bu soruya ait cevaplara verilmiş kullanıcı yanıtlarını sil
        const deleteUserResponsesResult = await client.query('DELETE FROM user_question_responses WHERE answer_id IN (SELECT id FROM answers WHERE question_id = $1)', [questionId]);
        console.log(`Deleted ${deleteUserResponsesResult.rowCount} user_question_responses for question ${questionId}.`);
        // 2. Bu soruya ait cevapları sil
        const deleteAnswersResult = await client.query('DELETE FROM answers WHERE question_id = $1', [questionId]);
        console.log(`Deleted ${deleteAnswersResult.rowCount} answers for question ${questionId}.`);
        // 3. Sorunun kendisini sil
        const deleteQuestionResult = await client.query('DELETE FROM questions WHERE id = $1 RETURNING *', [questionId]);
        console.log(`Deleted ${deleteQuestionResult.rowCount} question.`);
        if (deleteQuestionResult.rowCount === 0) {
            await client.query('ROLLBACK');
            console.log(`Question with ID ${questionId} not found during final delete step.`);
            return res.status(404).json({ message: 'Question not found' });
        }
        await client.query('COMMIT');
        console.log(`Question ${questionId} and all related data successfully deleted.`);
        res.status(200).json({ message: 'Question and all related data deleted successfully' });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error deleting question ID ${questionId}:`, error);
        res.status(500).json({
            message: 'Error deleting question',
            error: error.message
        });
    }
    finally {
        client.release();
    }
};
exports.deleteQuestion = deleteQuestion;
