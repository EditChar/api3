document.addEventListener('DOMContentLoaded', () => {
    const adminToken = localStorage.getItem('adminToken');
    const adminUser = JSON.parse(localStorage.getItem('adminUser'));

    if (!adminToken || !adminUser || adminUser.role !== 'admin') {
        alert('Giriş yapmadınız veya admin yetkiniz yok. Lütfen giriş yapın.');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        window.location.href = 'index.html'; // Login sayfasına yönlendir
        return;
    }

    const logoutButton = document.getElementById('logoutButton');
    const testSetsListContainer = document.getElementById('testSetsListContainer');
    const showCreateTestSetFormButton = document.getElementById('showCreateTestSetFormButton');
    const createTestSetFormContainer = document.getElementById('createTestSetFormContainer');
    const createTestSetForm = document.getElementById('createTestSetForm');
    const cancelCreateTestSetButton = document.getElementById('cancelCreateTestSet');

    const editTestSetFormContainer = document.getElementById('editTestSetFormContainer');
    const editTestSetForm = document.getElementById('editTestSetForm');
    const cancelEditTestSetButton = document.getElementById('cancelEditTestSet');

    const questionsContainer = document.getElementById('questionsContainer');
    const selectedTestSetTitleElement = document.getElementById('selectedTestSetTitle');
    const questionsListContainer = document.getElementById('questionsListContainer');
    const showAddQuestionFormButton = document.getElementById('showAddQuestionFormButton');
    const addQuestionFormContainer = document.getElementById('addQuestionFormContainer');
    const addQuestionForm = document.getElementById('addQuestionForm');
    const cancelAddQuestionButton = document.getElementById('cancelAddQuestion');
    const answersInputContainer = document.getElementById('answersInputContainer');
    const addAnswerOptionButton = document.getElementById('addAnswerOptionButton');

    // Soru Düzenleme Formu Elementleri - ARTIK GENEL DEĞİL, DİNAMİK OLACAK
    // const editQuestionFormContainer = document.getElementById('editQuestionFormContainer');
    // const editQuestionForm = document.getElementById('editQuestionForm');
    // const cancelEditQuestionButton = document.getElementById('cancelEditQuestion');
    // const editAnswersInputContainer = document.getElementById('editAnswersInputContainer');
    // const addEditAnswerOptionButton = document.getElementById('addEditAnswerOptionButton');
    // const editQuestionIdInput = document.getElementById('editQuestionId');
    // const editQuestionTestIdInput = document.getElementById('editQuestionTestId');
    // const editQuestionTextInput = document.getElementById('editQuestionText');

    let currentEditingTestSetId = null; // Düzenlenen test seti ID'si
    let currentSelectedTestSetIdForQuestions = null; // Soruları gösterilen test seti ID'si
    let answerOptionCount = 0; // Soru ekleme formundaki cevap sayısı
    let editAnswerOptionCount = 0; // Soru düzenleme formundaki cevap sayısı

    // --- Helper: Hata Mesajı Göster --- 
    function showErrorMessage(containerElement, message) {
        if (typeof containerElement === 'string') {
            containerElement = document.getElementById(containerElement);
        }
        if(containerElement) {
            containerElement.innerHTML = `<p class="error-message" style="display:block;">${escapeHTML(message)}</p>`;
        } else {
            alert(message); // Fallback
        }
    }

    // --- Çıkış Yapma ---
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        window.location.href = 'index.html';
    });

    // --- API İstekleri için Helper Fonksiyon ---
    async function fetchAPI(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`,
            },
        };
        const mergedOptions = { ...defaultOptions, ...options };
        mergedOptions.headers = { ...defaultOptions.headers, ...options.headers }; 

        const response = await fetch(url, mergedOptions);
        if (response.status === 401 || response.status === 403) { // Token süresi dolmuş veya yetkisiz
            alert('Oturumunuz sonlanmış veya yetkiniz yok. Lütfen tekrar giriş yapın.');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            window.location.href = 'index.html';
            throw new Error('Unauthorized or Forbidden');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Bilinmeyen bir sunucu hatası oluştu.' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    // --- Test Setlerini Yükle ve Göster ---
    async function loadTestSets() {
        testSetsListContainer.innerHTML = '<p>Yükleniyor...</p>';
        questionsContainer.style.display = 'none'; // Soru bölümünü gizle
        addQuestionFormContainer.style.display = 'none';
        editTestSetFormContainer.style.display = 'none';
        createTestSetFormContainer.style.display = 'none'; 
        try {
            const tests = await fetchAPI('/api/tests');
            renderTestSets(tests);
        } catch (error) {
            console.error('Test setleri yüklenirken hata:', error);
            showErrorMessage(testSetsListContainer, `Test setleri yüklenemedi: ${error.message}`);
        }
    }

    function renderTestSets(tests) {
        if (!tests || tests.length === 0) {
            testSetsListContainer.innerHTML = '<p>Gösterilecek test seti bulunamadı. Yeni bir tane oluşturun!</p>';
            return;
        }
        let html = '<ul>';
        tests.forEach(test => {
            const isVisible = test.is_visible;
            const visibilityClass = isVisible ? 'test-item-visible' : 'test-item-hidden';
            const visibilityButtonText = isVisible ? 'Gizle' : 'Aktif Et';
            const visibilityButtonClass = isVisible ? 'visibility-btn-hide' : 'visibility-btn-show';
            
            html += `
                <li data-testid="${test.id}" class="test-item ${visibilityClass}">
                    <div class="test-item-content">
                        <strong>${escapeHTML(test.title)}</strong> 
                        (ID: ${test.id}) <br>
                        <small>${escapeHTML(test.description || 'Açıklama yok')}</small><br>
                        <small>Oluşturan: ${test.creator ? escapeHTML(test.creator.username) : 'Bilinmiyor'}, Tarih: ${new Date(test.created_at).toLocaleDateString()}</small>
                        <div class="test-actions">
                            <button class="button-style view-questions-btn" data-testid="${test.id}" data-testtitle="${escapeHTML(test.title)}">Soruları Yönet</button>
                            <button class="button-style edit-test-set-btn" data-testid="${test.id}">Düzenle</button>
                            <button class="button-style ${visibilityButtonClass} toggle-visibility-btn" data-testid="${test.id}" data-visible="${isVisible}">${visibilityButtonText}</button>
                            <button class="button-style danger-btn delete-test-set-btn" data-testid="${test.id}">Sil</button>
                        </div>
                    </div>
                </li>
            `;
        });
        html += '</ul>';
        testSetsListContainer.innerHTML = html;

        // Event listeners for new buttons
        document.querySelectorAll('.view-questions-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const testId = e.target.dataset.testid;
                const testTitle = e.target.dataset.testtitle;
                loadQuestionsForTestSet(testId, testTitle);
            });
        });
        document.querySelectorAll('.edit-test-set-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const testId = e.target.dataset.testid;
                const testToEdit = tests.find(t => t.id == testId);
                if (testToEdit) {
                    openEditTestSetForm(testToEdit);
                }
            });
        });
        document.querySelectorAll('.delete-test-set-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const testId = e.target.dataset.testid;
                deleteTestSet(testId);
            });
        });

        document.querySelectorAll('.toggle-visibility-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const testId = e.target.dataset.testid;
                const isCurrentlyVisible = e.target.dataset.visible === 'true';
                toggleTestVisibility(testId, isCurrentlyVisible);
            });
        });
    }

    // --- Yeni Test Seti Oluşturma Formu Göster/Gizle ---
    showCreateTestSetFormButton.addEventListener('click', () => {
        createTestSetFormContainer.style.display = 'block';
        editTestSetFormContainer.style.display = 'none'; 
        questionsContainer.style.display = 'none';
    });

    cancelCreateTestSetButton.addEventListener('click', () => {
        createTestSetFormContainer.style.display = 'none';
        createTestSetForm.reset();
    });

    // --- Yeni Test Seti Oluşturma İşlemi ---
    createTestSetForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = document.getElementById('testSetTitle').value;
        const description = document.getElementById('testSetDescription').value;

        if (!title.trim()) {
            alert('Test başlığı boş olamaz.');
            return;
        }

        try {
            await fetchAPI('/api/tests', {
                method: 'POST',
                body: JSON.stringify({ title, description }),
            });
            alert('Test seti başarıyla oluşturuldu!');
            createTestSetForm.reset();
            createTestSetFormContainer.style.display = 'none';
            loadTestSets(); // Listeyi yenile
        } catch (error) {
            console.error('Test seti oluşturulurken hata:', error);
            alert(`Test seti oluşturulamadı: ${error.message}`);
        }
    });
    
    // --- Test Seti Düzenleme --- 
    function openEditTestSetForm(testSet) {
        if (!testSet) return;
        currentEditingTestSetId = testSet.id;
        document.getElementById('editTestSetId').value = testSet.id;
        document.getElementById('editTestSetTitle').value = testSet.title;
        document.getElementById('editTestSetDescription').value = testSet.description || '';
        
        editTestSetFormContainer.style.display = 'block';
        createTestSetFormContainer.style.display = 'none';
        questionsContainer.style.display = 'none';
    }

    cancelEditTestSetButton.addEventListener('click', () => {
        editTestSetFormContainer.style.display = 'none';
        editTestSetForm.reset();
        currentEditingTestSetId = null;
    });

    editTestSetForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const id = document.getElementById('editTestSetId').value;
        const title = document.getElementById('editTestSetTitle').value;
        const description = document.getElementById('editTestSetDescription').value;

        if (!title.trim()) {
            alert('Test başlığı boş olamaz.');
            return;
        }
        if (!id) {
            alert('Düzenlenecek test seti ID si bulunamadı.');
            return;
        }

        try {
            await fetchAPI(`/api/tests/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ title, description }),
            });
            alert('Test seti başarıyla güncellendi!');
            editTestSetForm.reset();
            editTestSetFormContainer.style.display = 'none';
            currentEditingTestSetId = null;
            loadTestSets(); // Listeyi yenile
        } catch (error) {
            console.error('Test seti güncellenirken hata:', error);
            alert(`Test seti güncellenemedi: ${error.message}`);
        }
    });

    // --- Test Görünürlük Değiştirme ---
    async function toggleTestVisibility(testSetId, isCurrentlyVisible) {
        if (!testSetId) {
            alert('Test seti ID si bulunamadı.');
            return;
        }
        
        const action = isCurrentlyVisible ? 'gizlemek' : 'aktif etmek';
        if (confirm(`Test setini ${action} istediğinizden emin misiniz?`)) {
            try {
                const result = await fetchAPI(`/api/tests/${testSetId}/visibility`, {
                    method: 'PATCH',
                });
                alert(result.message);
                loadTestSets(); // Listeyi yenile
            } catch (error) {
                console.error('Test seti görünürlük değiştirilirken hata:', error);
                alert(`Test seti görünürlüğü değiştirilemedi: ${error.message}`);
            }
        }
    }

    // --- Test Seti Silme ---
    async function deleteTestSet(testSetId) {
        if (!testSetId) {
            alert('Silinecek test seti ID si bulunamadı.');
            return;
        }
        if (confirm(`Test setini (ID: ${testSetId}) silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve içindeki tüm sorular silinir!`)) {
            try {
                await fetchAPI(`/api/tests/${testSetId}`, {
                    method: 'DELETE',
                });
                alert('Test seti başarıyla silindi!');
                if (String(currentSelectedTestSetIdForQuestions) === String(testSetId)) {
                    questionsContainer.style.display = 'none';
                    currentSelectedTestSetIdForQuestions = null;
                }
                loadTestSets(); // Listeyi yenile
            } catch (error) {
                console.error('Test seti silinirken hata:', error);
                alert(`Test seti silinemedi: ${error.message}`);
            }
        }
    }

    // --- Soruları Yükle ve Göster ---
    async function loadQuestionsForTestSet(testId, testTitle) {
        if (!testId) return;
        currentSelectedTestSetIdForQuestions = testId;
        selectedTestSetTitleElement.textContent = `"${escapeHTML(testTitle)}" Test Seti İçin Sorular`;
        questionsListContainer.innerHTML = '<p>Sorular yükleniyor...</p>';
        questionsContainer.style.display = 'block';
        addQuestionFormContainer.style.display = 'none'; // Soru ekleme formunu gizle
        editTestSetFormContainer.style.display = 'none'; // Diğer formları da gizle
        createTestSetFormContainer.style.display = 'none';
        // editQuestionFormContainer.style.display = 'none'; // Kaldırıldı

        try {
            const questions = await fetchAPI(`/api/tests/${testId}/questions`);
            renderQuestions(questions, testId);
             // Soru ekleme formunu hazırla ama gösterme
            prepareAddQuestionForm();
        } catch (error) {
            console.error(`'${testTitle}' için sorular yüklenirken hata:`, error);
            showErrorMessage(questionsListContainer, `Sorular yüklenemedi: ${error.message}`);
        }
    }

    function renderQuestions(questions, testId) {
        if (!questions || questions.length === 0) {
            questionsListContainer.innerHTML = '<p>Bu test setine henüz soru eklenmemiş. Yukarıdaki butonu kullanarak ekleyebilirsiniz.</p>';
            return;
        }
        let html = '<ul>';
        questions.forEach(question => {
            html += `
                <li data-questionid="${question.id}">
                    <strong>Soru ${question.id}:</strong> ${escapeHTML(question.question_text)}
                    <ul>
                        ${question.answers && question.answers.map(ans => 
                            `<li>${escapeHTML(ans.answer_text)} (Puan: ${ans.score})</li>`
                        ).join('')}
                    </ul>
                    <div>
                        <button class="button-style secondary-btn edit-question-btn" data-questionid="${question.id}" data-testid="${testId}">Düzenle</button>
                        <button class="button-style danger-btn delete-question-btn" data-questionid="${question.id}" data-testid="${testId}">Sil</button>
                    </div>
                    <div class="edit-question-form-placeholder" id="edit-form-placeholder-${question.id}" style="display:none; margin-top:15px;">
                        <!-- Dinamik soru düzenleme formu buraya gelecek -->
                    </div>
                </li>
            `;
        });
        html += '</ul>';
        questionsListContainer.innerHTML = html;

        document.querySelectorAll('.delete-question-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const qId = e.target.dataset.questionid;
                const tId = e.target.dataset.testid;
                deleteQuestion(tId, qId);
            });
        });
        // Düzenleme butonları için listener'lar (şimdilik bir alert)
        document.querySelectorAll('.edit-question-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                // alert(`Soru ID ${e.target.dataset.questionid} düzenleme henüz implemente edilmedi.`);
                const questionId = e.target.dataset.questionid;
                const testId = e.target.dataset.testid;
                // API'den tam soru detayını (cevaplarla birlikte) tekrar çekmek daha güvenli olabilir
                // Çünkü renderQuestions içindeki question objesi eksik bilgi içerebilir veya güncel olmayabilir
                try {
                    const questionDetails = await fetchAPI(`/api/tests/${testId}/questions/${questionId}`);
                    openEditQuestionForm(questionDetails, testId, button.closest('li').querySelector('.edit-question-form-placeholder'));
                } catch (error) {
                    alert(`Soru detayları yüklenemedi: ${error.message}`);
                }
            });
        });
    }

    // --- Soru Ekleme Formu İşlevleri ---
    showAddQuestionFormButton.addEventListener('click', () => {
        if (!currentSelectedTestSetIdForQuestions) {
            alert('Lütfen önce sorularını eklemek istediğiniz bir test seti seçin.');
            return;
        }
        addQuestionFormContainer.style.display = 'block';
        prepareAddQuestionForm(); // Formu sıfırla ve ilk cevap alanlarını ekle
    });

    cancelAddQuestionButton.addEventListener('click', () => {
        addQuestionFormContainer.style.display = 'none';
        addQuestionForm.reset();
        answersInputContainer.innerHTML = ''; // Cevap alanlarını temizle
        answerOptionCount = 0;
    });
    
    function prepareAddQuestionForm() {
        addQuestionForm.reset();
        answersInputContainer.innerHTML = '';
        answerOptionCount = 0;
        // Başlangıçta belirli sayıda cevap alanı ekleyebiliriz, örneğin 4 tane
        for (let i = 0; i < 4; i++) { 
            addAnswerOption();
        }
        // Veya html içinde sabit olarak 5 tane tutup, JS ile yönetebiliriz. 
        // Şimdilik dinamik eklemeye devam edelim. Max 5 kontrolünü ekleyelim.
    }

    addAnswerOptionButton.addEventListener('click', () => {
        if (answerOptionCount < 5) { // En fazla 5 cevap
            addAnswerOption();
        } else {
            alert('Bir soruya en fazla 5 cevap seçeneği ekleyebilirsiniz.');
        }
    });

    function addAnswerOption() {
        answerOptionCount++;
        const newAnswerDiv = document.createElement('div');
        newAnswerDiv.classList.add('answer-option');
        newAnswerDiv.innerHTML = `
            <textarea name="answer_text_${answerOptionCount}" placeholder="Cevap Metni ${answerOptionCount}" required></textarea>
            <input type="number" name="score_${answerOptionCount}" placeholder="Puan (1-5)" required value="1" min="1" max="5">
            <button type="button" class="button-style danger-btn remove-answer-btn">Bu Cevabı Sil</button>
        `;
        answersInputContainer.appendChild(newAnswerDiv);

        newAnswerDiv.querySelector('.remove-answer-btn').addEventListener('click', function() {
            if (answerOptionCount > 1) { // En az 1 cevap kalmalı
                this.closest('.answer-option').remove();
                answerOptionCount--;
                // Kalan cevapları yeniden numaralandırmak/güncellemek gerekebilir, ama şimdilik basit tutalım.
                // Form gönderilirken name'ler üzerinden doğru alınır.
            } else {
                alert('Bir sorunun en az bir cevap seçeneği olmalıdır.');
            }
        });
    }

    addQuestionForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!currentSelectedTestSetIdForQuestions) {
            alert('Soru eklenecek test seti seçilmedi!');
            return;
        }

        const questionText = document.getElementById('questionText').value;
        if (!questionText.trim()) {
            alert('Soru metni boş olamaz.');
            return;
        }

        const answers = [];
        const answerOptions = answersInputContainer.querySelectorAll('.answer-option');

        if (answerOptions.length === 0) {
            alert('Lütfen en az bir cevap seçeneği ekleyin.');
            return;
        }
        if (answerOptions.length > 5) {
            alert('En fazla 5 cevap seçeneği girebilirsiniz.');
            return;
        }

        let allAnswersValid = true;
        answerOptions.forEach((option, index) => {
            const textInput = option.querySelector('textarea'); // name ile almak yerine doğrudan seçelim
            const scoreInput = option.querySelector('input[type="number"]');
            
            const answerText = textInput ? textInput.value.trim() : '';
            const score = scoreInput ? parseInt(scoreInput.value) : NaN;

            if (!answerText) {
                alert(`Lütfen ${index + 1}. cevap metnini girin.`);
                allAnswersValid = false;
                return; // forEach'tan çıkmak için değil, callback'ten çıkmak için
            }
            if (isNaN(score) || score < 1 || score > 5) {
                alert(`Lütfen ${index + 1}. cevap için 1 ile 5 arasında geçerli bir puan girin.`);
                allAnswersValid = false;
                return; // forEach'tan çıkmak için değil, callback'ten çıkmak için
            }
            answers.push({ answer_text: answerText, score: score });
        });

        if (!allAnswersValid) return;
        
        if (answers.length < 1) { // Bu kontrol yukarıdakiyle dublike olabilir ama zararı yok
            alert('Lütfen en az 1 cevap ve puanını girin.');
            return;
        }


        try {
            await fetchAPI(`/api/tests/${currentSelectedTestSetIdForQuestions}/questions`, {
                method: 'POST',
                body: JSON.stringify({ question_text: questionText, answers: answers }),
            });
            alert('Soru başarıyla eklendi!');
            addQuestionForm.reset();
            answersInputContainer.innerHTML = '';
            answerOptionCount = 0;
            addQuestionFormContainer.style.display = 'none';
            // Soruları yeniden yükle
            const currentTestTitle = selectedTestSetTitleElement.textContent.replace(' Test Seti İçin Sorular', '').replace(/"/g, '');
            loadQuestionsForTestSet(currentSelectedTestSetIdForQuestions, currentTestTitle);
        } catch (error) {
            console.error('Soru eklenirken hata:', error);
            alert(`Soru eklenemedi: ${error.message}`);
        }
    });

    // --- Soru Silme ---
    async function deleteQuestion(testId, questionId) {
        if (!testId || !questionId) {
            alert('Silinecek soru veya test ID si bulunamadı.');
            return;
        }
        if (confirm(`Soruyu (ID: ${questionId}) silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!`)) {
            try {
                await fetchAPI(`/api/tests/${testId}/questions/${questionId}`, {
                    method: 'DELETE',
                });
                alert('Soru başarıyla silindi!');
                // Soruları yeniden yükle
                const currentTestTitle = selectedTestSetTitleElement.textContent.replace(' Test Seti İçin Sorular', '').replace(/"/g, '');
                loadQuestionsForTestSet(testId, currentTestTitle);
            } catch (error) {
                console.error('Soru silinirken hata:', error);
                alert(`Soru silinemedi: ${error.message}`);
            }
        }
    }

    // --- Soru Düzenleme Formu İşlevleri (Dinamik Formlar İçin Yeniden Yapılandırılacak) ---
    function openEditQuestionForm(question, testId, placeholderElement) {
        if (!question || !testId || !placeholderElement) {
            alert('Düzenlenecek soru bilgileri veya hedef element eksik.');
            return;
        }

        // Varsa diğer açık düzenleme formlarını kapat/temizle
        document.querySelectorAll('.edit-question-form-placeholder').forEach(ph => {
            if (ph !== placeholderElement) {
                ph.innerHTML = '';
                ph.style.display = 'none';
            }
        });

        const formId = `editQuestionForm-${question.id}`;
        const questionTextInputId = `editQuestionText-${question.id}`;
        const answersContainerId = `editAnswersContainer-${question.id}`;
        const addAnswerButtonId = `addEditAnswerBtn-${question.id}`;
        const cancelFormButtonId = `cancelEditQuestionBtn-${question.id}`;

        let localEditAnswerOptionCount = 0;

        const formHTML = `
            <div class="form-container" style="background-color: #e9ecef; padding:15px; border-radius:5px;">
                <h4>"${escapeHTML(question.question_text.substring(0,50))}..." Sorusunu Düzenle</h4>
                <form id="${formId}">
                    <input type="hidden" name="editQuestionId" value="${question.id}">
                    <input type="hidden" name="editQuestionTestId" value="${testId}">
                    <div>
                        <label for="${questionTextInputId}">Soru Metni:</label>
                        <textarea id="${questionTextInputId}" class="dynamic-edit-question-text" required>${escapeHTML(question.question_text)}</textarea>
                    </div>
                    <h5>Cevaplar</h5>
                    <div id="${answersContainerId}" class="dynamic-edit-answers-container">
                        <!-- Dinamik cevaplar buraya -->
                    </div>
                    <button type="button" id="${addAnswerButtonId}" class="button-style" style="margin-bottom: 10px;">Cevap Ekle (+)</button>
                    <br>
                    <button type="submit" class="button-style">Soruyu Güncelle</button>
                    <button type="button" id="${cancelFormButtonId}" class="button-style secondary-btn">İptal</button>
                </form>
            </div>
        `;
        placeholderElement.innerHTML = formHTML;
        placeholderElement.style.display = 'block';

        const dynamicForm = document.getElementById(formId);
        const dynamicAnswersContainer = document.getElementById(answersContainerId);
        const dynamicAddAnswerButton = document.getElementById(addAnswerButtonId);
        const dynamicCancelButton = document.getElementById(cancelFormButtonId);
        // const dynamicQuestionTextInput = document.getElementById(questionTextInputId); // Zaten textarea'ya değeri verdik

        function addAnswerOptionForDynamicEdit(text = '', score = 1, answerId = null) {
            localEditAnswerOptionCount++;
            const answerDiv = document.createElement('div');
            answerDiv.classList.add('answer-option');
            answerDiv.innerHTML = `
                <input type="hidden" name="edit_answer_id_${localEditAnswerOptionCount}" value="${answerId || 'new'}">
                <textarea name="edit_answer_text_${localEditAnswerOptionCount}" placeholder="Cevap Metni" required>${escapeHTML(text)}</textarea>
                <input type="number" name="edit_score_${localEditAnswerOptionCount}" placeholder="Puan (1-5)" required value="${score}" min="1" max="5">
                <button type="button" class="button-style danger-btn remove-dynamic-edit-answer-btn">Sil</button>
            `;
            dynamicAnswersContainer.appendChild(answerDiv);
            answerDiv.querySelector('.remove-dynamic-edit-answer-btn').addEventListener('click', function(){
                if (localEditAnswerOptionCount > 1) {
                    this.closest('.answer-option').remove();
                    localEditAnswerOptionCount--;
                } else {
                    alert('Bir sorunun en az bir cevap seçeneği olmalıdır.');
                }
            });
        }

        if (question.answers && question.answers.length > 0) {
            question.answers.forEach(ans => addAnswerOptionForDynamicEdit(ans.answer_text, ans.score, ans.id));
        } else {
            addAnswerOptionForDynamicEdit(); // En az bir boş cevap alanı
        }

        dynamicAddAnswerButton.addEventListener('click', () => {
            if (localEditAnswerOptionCount < 5) {
                addAnswerOptionForDynamicEdit();
            } else {
                alert('Bir soruya en fazla 5 cevap seçeneği ekleyebilirsiniz.');
            }
        });

        dynamicCancelButton.addEventListener('click', () => {
            placeholderElement.innerHTML = '';
            placeholderElement.style.display = 'none';
        });

        dynamicForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const qId = question.id; // event.target.elements.editQuestionId.value;
            const tId = testId;    // event.target.elements.editQuestionTestId.value;
            const qText = dynamicForm.querySelector('.dynamic-edit-question-text').value;

            if (!qText.trim()) {
                alert('Soru metni boş olamaz.');
                return;
            }

            const answersPayload = [];
            const answerOptions = dynamicAnswersContainer.querySelectorAll('.answer-option');
            if (answerOptions.length === 0 || answerOptions.length > 5) {
                alert('Lütfen 1 ile 5 arasında cevap seçeneği girin.');
                return;
            }

            let allAnswersValid = true;
            answerOptions.forEach((option, index) => {
                const ansIdInput = option.querySelector('input[type="hidden"]');
                const ansTextInput = option.querySelector('textarea');
                const ansScoreInput = option.querySelector('input[type="number"]');

                const ansText = ansTextInput ? ansTextInput.value.trim() : '';
                const ansScore = ansScoreInput ? parseInt(ansScoreInput.value) : NaN;
                const ansId = ansIdInput ? (ansIdInput.value === 'new' ? null : parseInt(ansIdInput.value)) : null;

                if (!ansText) {
                    alert(`Lütfen ${index + 1}. cevap metnini girin.`);
                    allAnswersValid = false; return;
                }
                if (isNaN(ansScore) || ansScore < 1 || ansScore > 5) {
                    alert(`Lütfen ${index + 1}. cevap için 1 ile 5 arasında geçerli bir puan girin.`);
                    allAnswersValid = false; return;
                }
                const currentAnswerPayload = { answer_text: ansText, score: ansScore };
                if (ansId !== null) {
                    currentAnswerPayload.id = ansId;
                }
                answersPayload.push(currentAnswerPayload);
            });

            if (!allAnswersValid) return;

            try {
                await fetchAPI(`/api/tests/${tId}/questions/${qId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ question_text: qText, answers: answersPayload }),
                });
                alert('Soru başarıyla güncellendi!');
                placeholderElement.innerHTML = ''; // Formu temizle
                placeholderElement.style.display = 'none';
                loadQuestionsForTestSet(tId, selectedTestSetTitleElement.textContent.replace(' Test Seti İçin Sorular', '').replace(/"/g, '')); // Soru listesini yenile
            } catch (error) {
                console.error('Soru güncellenirken hata:', error);
                alert(`Soru güncellenemedi: ${error.message}`);
            }
        });
    }

    // HTML metinlerini güvenli hale getirmek için
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Sayfa yüklendiğinde test setlerini yükle
    loadTestSets(); 

    // Diğer fonksiyonlar (Test Seti Düzenleme, Silme, Soru Ekleme vs.) buraya eklenecek...
}); 