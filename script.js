document.addEventListener('DOMContentLoaded', () => {
    const characterImage = document.getElementById('character-image');
    const userBubble = document.getElementById('user-bubble');
    const userText = document.getElementById('user-text');
    const mascotBubble = document.getElementById('mascot-bubble');
    const mascotText = document.getElementById('mascot-text');
    const buttonArea = document.getElementById('button-area');
    const contextMenu = document.getElementById('context-menu');
    const openMenuButton = document.getElementById('open-menu-button');
    const exitButton = document.getElementById('exit-button');

    let currentMascot = "Mascot"; // デフォルトのマスコット
    let messages = {}; // messages.json の内容を格納
    let settings = {}; // settings.json の内容を格納

    let autoHideTimer;
    let idleAnimationTimer;
    let monologueTimer;
    let moodTimer;

    let currentMood = 50; // 0-100で気分を表現 (50が普通)
    const MOOD_MAX = 100;
    const MOOD_MIN = 0;

    let isDraggingMascot = false;
    let offsetX, offsetY; // ドラッグ開始時のマスコットとマウスの相対位置

    // なでなでエフェクト用
    let lastMouseX = -1;
    let pettingSequenceCount = 0; // 0:初期状態, 1:右, 2:右左, 3:右左右, 4:右左右左
    const PETTING_THRESHOLD = 10; // マウス移動の閾値

    // --- 初期化処理 ---
    async function initialize() {
        await loadSettings();
        await loadMessages();
        setupButtonTexts();
        initializeTimers();
        setupEventHandlers();
        hideBubbles();
        setMascotImage("default"); // 初期画像を設定
    }

    async function loadSettings() {
        try {
            const response = await fetch('settings.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            settings = await response.json();
            if (settings.current_mascot) {
                // キャラクター名の先頭を大文字に変換
                currentMascot = settings.current_mascot.charAt(0).toUpperCase() + settings.current_mascot.slice(1);
            }
        } catch (error) {
            console.error('設定ファイルの読み込みに失敗しました:', error);
            // エラー時はデフォルトのマスコットを使用
            currentMascot = "Mascot";
        }
    }

    async function loadMessages() {
        try {
            const response = await fetch('messages.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            messages = await response.json();
        } catch (error) {
            console.error('メッセージファイルの読み込みに失敗しました:', error);
            // エラー時は空のメッセージを使用
            messages = {
                "Mascot": {
                    "Greetings": ["こんにちは！"],
                    "Monologues": [{ "Text": "エラーが発生しました。", "Image": "sad" }]
                }
            };
        }
    }

    function initializeTimers() {
        // autoHideTimer
        autoHideTimer = setTimeout(() => {
            hideBubbles();
        }, 10000); // 10秒

        // idleAnimationTimer
        idleAnimationTimer = setInterval(() => {
            doIdleAnimation();
        }, getRandomInt(10, 20) * 1000); // 10秒から20秒

        // monologueTimer
        monologueTimer = setInterval(() => {
            doMonologue();
        }, getRandomInt(20, 60) * 1000); // 20秒から60秒

        // moodTimer
        moodTimer = setInterval(() => {
            decreaseMood(5);
        }, 30 * 1000); // 30秒
    }

    function setupEventHandlers() {
        // ウィンドウのドラッグ移動 (body全体をドラッグ可能にする)
        document.body.addEventListener('mousedown', (e) => {
            // マスコット画像、ボタン、吹き出し、コンテキストメニュー以外をドラッグ可能にする
            if (e.target !== characterImage && !buttonArea.contains(e.target) && !userBubble.contains(e.target) && !mascotBubble.contains(e.target) && !contextMenu.contains(e.target)) {
                isDraggingMascot = true;
                offsetX = e.clientX - window.screenX;
                offsetY = e.clientY - window.screenY;
                document.body.style.cursor = 'grabbing';
            }
        });

        document.body.addEventListener('mousemove', (e) => {
            if (isDraggingMascot) {
                window.moveTo(e.clientX - offsetX, e.clientY - offsetY);
            }
        });

        document.body.addEventListener('mouseup', () => {
            isDraggingMascot = false;
            document.body.style.cursor = 'default';
        });

        // マスコットのクリックイベント
        characterImage.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // 左クリック
                isDraggingMascot = true; // マスコットのドラッグ開始
                offsetX = e.clientX - characterImage.getBoundingClientRect().left;
                offsetY = e.clientY - characterImage.getBoundingClientRect().top;
                characterImage.style.cursor = 'grabbing';
                animateCharacter(); // クリック時のアニメーション
                setMascotImage("tickle"); // なでなでされた表情
                clearInterval(idleAnimationTimer); // アイドルアニメーションを一時停止
                increaseMood(10); // クリックで気分上昇
                e.preventDefault(); // デフォルトのドラッグ動作を抑制
            } else if (e.button === 2) { // 右クリック
                showContextMenu(e);
                e.preventDefault(); // デフォルトのコンテキストメニューを抑制
            }
        });

        characterImage.addEventListener('mousemove', (e) => {
            if (isDraggingMascot && e.buttons === 1) { // 左クリックが押されている間
                setMascotImage("happy"); // ドラッグ中は嬉しい表情
                // マスコットをマウスの位置に追従させる
                characterImage.style.left = (e.clientX - offsetX) + 'px';
                characterImage.style.top = (e.clientY - offsetY) + 'px';
            }

            // なでなでエフェクトの検出
            if (e.buttons === 1 && !isDraggingMascot) { // 左クリック中でドラッグではない場合
                const currentMouseX = e.clientX;

                if (lastMouseX === -1) {
                    lastMouseX = currentMouseX;
                    return;
                }

                const deltaX = currentMouseX - lastMouseX;

                if (Math.abs(deltaX) > PETTING_THRESHOLD) {
                    if (pettingSequenceCount === 0 && deltaX > 0) { // 右に移動 (R)
                        pettingSequenceCount = 1;
                    } else if (pettingSequenceCount === 1 && deltaX < 0) { // 左に移動 (RL)
                        pettingSequenceCount = 2;
                    } else if (pettingSequenceCount === 2 && deltaX > 0) { // 右に移動 (RLR)
                        pettingSequenceCount = 3;
                    } else if (pettingSequenceCount === 3 && deltaX < 0) { // 左に移動 (RLRL)
                        pettingSequenceCount = 4;
                        doPettingEffect(); // なでなでエフェクト発動！
                        pettingSequenceCount = 0; // リセット
                    } else {
                        pettingSequenceCount = 0; // パターンが崩れたらリセット
                    }
                    lastMouseX = currentMouseX;
                }
            } else {
                // マウスボタンが離れたらリセット
                pettingSequenceCount = 0;
                lastMouseX = -1;
            }
        });

        characterImage.addEventListener('mouseup', () => {
            if (isDraggingMascot) {
                isDraggingMascot = false;
                characterImage.style.cursor = 'grab';
                setMascotImage("default"); // 元の画像に戻す
                idleAnimationTimer = setInterval(() => { // アイドルアニメーションを再開
                    doIdleAnimation();
                }, getRandomInt(10, 20) * 1000);
            }
        });

        // ドキュメント全体での右クリックイベントでコンテキストメニューを非表示にする
        document.addEventListener('click', (e) => {
            if (contextMenu.style.display === 'block' && !contextMenu.contains(e.target) && e.target !== characterImage) {
                contextMenu.style.display = 'none';
            }
        });

        // コンテキストメニューのボタンイベント
        openMenuButton.addEventListener('click', () => {
            alert('メニューを開く機能は未実装です。'); // 仮の処理
            contextMenu.style.display = 'none';
        });

        exitButton.addEventListener('click', () => {
            if (confirm('アプリケーションを終了しますか？')) {
                window.close(); // ブラウザのタブ/ウィンドウを閉じる
            }
            contextMenu.style.display = 'none';
        });

        // 会話ボタンのイベントハンドラ
        document.getElementById('greeting-button').addEventListener('click', () => handleConversation(getPrompt('Greeting'), "Greetings", "happy"));
        document.getElementById('weather-button').addEventListener('click', () => handleConversation(getPrompt('Weather'), "Weather", "thoughtful"));
        document.getElementById('time-button').addEventListener('click', () => {
            showUserBubble(getPrompt('Time'));
            const mascotResponse = getTimeMessage();
            showMascotBubble(mascotResponse);
            setMascotImage("look_up");
            clearTimeout(autoHideTimer);
            autoHideTimer = setTimeout(hideBubbles, 10000);
        });
        document.getElementById('joke-button').addEventListener('click', () => handleConversation(getPrompt('Joke'), "Jokes", "happy"));
        document.getElementById('goodbye-button').addEventListener('click', () => handleConversation(getPrompt('Goodbye'), "Goodbyes", "sad"));
        document.getElementById('howareyou-button').addEventListener('click', () => handleConversation(getPrompt('HowAreYou'), "HowAreYou", "happy"));
        document.getElementById('compliment-button').addEventListener('click', () => handleConversation(getPrompt('Compliment'), "Compliments", "love"));
        document.getElementById('motivation-button').addEventListener('click', () => handleConversation(getPrompt('Motivation'), "Motivation", "happy"));
        document.getElementById('advice-button').addEventListener('click', () => handleConversation(getPrompt('Advice'), "Advice", "thoughtful"));
        document.getElementById('story-button').addEventListener('click', () => handleConversation(getPrompt('Story'), "Stories", "happy"));
        document.getElementById('food-button').addEventListener('click', () => handleConversation(getPrompt('Food'), "Food", "hungry"));
        document.getElementById('music-button').addEventListener('click', () => handleConversation(getPrompt('Music'), "Music", "happy"));
        document.getElementById('study-button').addEventListener('click', () => handleConversation(getPrompt('Study'), "Study", "thoughtful"));
        document.getElementById('sleep-button').addEventListener('click', () => handleConversation(getPrompt('Sleep'), "Sleep", "sleepy"));
        document.getElementById('thanks-button').addEventListener('click', () => handleConversation(getPrompt('Thanks'), "Thanks", "love"));
    }

    function setupButtonTexts() {
        const prompts = messages[currentMascot]?.Prompts || {};
        document.getElementById('greeting-button').textContent = prompts.Greeting || 'あいさつ';
        document.getElementById('weather-button').textContent = prompts.Weather || '天気';
        document.getElementById('time-button').textContent = prompts.Time || '時間';
        document.getElementById('joke-button').textContent = prompts.Joke || 'ジョーク';
        document.getElementById('goodbye-button').textContent = prompts.Goodbye || 'さようなら';
        document.getElementById('howareyou-button').textContent = prompts.HowAreYou || '元気？';
        document.getElementById('compliment-button').textContent = prompts.Compliment || 'ほめる';
        document.getElementById('motivation-button').textContent = prompts.Motivation || '励ます';
        document.getElementById('advice-button').textContent = prompts.Advice || 'アドバイス';
        document.getElementById('story-button').textContent = prompts.Story || 'お話';
        document.getElementById('food-button').textContent = prompts.Food || '食べ物';
        document.getElementById('music-button').textContent = prompts.Music || '音楽';
        document.getElementById('study-button').textContent = prompts.Study || '勉強';
        document.getElementById('sleep-button').textContent = prompts.Sleep || '寝る';
        document.getElementById('thanks-button').textContent = prompts.Thanks || 'ありがとう';
    }

    function getPrompt(category) {
        return messages[currentMascot]?.Prompts?.[category] || category;
    }

    function showUserBubble(text) {
        userText.textContent = text;
        userBubble.style.display = 'block';
        userBubble.style.opacity = 1;
    }

    function showMascotBubble(text) {
        mascotText.textContent = text;
        mascotBubble.style.display = 'block';
        mascotBubble.style.opacity = 1;
    }

    function hideBubbles() {
        userBubble.style.display = 'none';
        mascotBubble.style.display = 'none';
        userBubble.style.opacity = 0;
        mascotBubble.style.opacity = 0;
        setMascotImage(getMascotImageBasedOnMood());
    }

    function animateCharacter() {
        characterImage.classList.add('animate');
        setTimeout(() => {
            characterImage.classList.remove('animate');
        }, 200); // アニメーション時間に合わせて調整
    }

    async function doIdleAnimation(animationType = null) {
        hideBubbles();

        const type = animationType === null ? getRandomInt(0, 4) : animationType;

        switch (type) {
            case 0: // 伸び
                setMascotImage("stretch_start");
                await sleep(500);
                setMascotImage("stretch_end");
                await sleep(500);
                break;
            case 1: // あくび
                setMascotImage("yawn");
                await sleep(1000);
                break;
            case 2: // きょろきょろ
                setMascotImage("look_left");
                await sleep(500);
                setMascotImage("look_right");
                await sleep(500);
                setMascotImage("look_up");
                await sleep(500);
                break;
            case 3: // 座る
                setMascotImage("sit");
                await sleep(2000);
                break;
            case 4: // 寝転がる
                setMascotImage("lie_down");
                await sleep(3000);
                break;
        }
        setMascotImage("default");
    }

    async function doPettingEffect() {
        clearInterval(idleAnimationTimer);

        setMascotImage("happy");
        showMascotBubble("なでなで、きもちいい〜！");
        increaseMood(20);

        await sleep(2000);

        hideBubbles();
        setMascotImage("default");
        idleAnimationTimer = setInterval(() => {
            doIdleAnimation();
        }, getRandomInt(10, 20) * 1000);
    }

    async function doMonologue() {
        if (userBubble.style.display === 'block' || mascotBubble.style.display === 'block') {
            return;
        }

        const monologues = messages[currentMascot]?.Monologues || [];
        if (monologues.length === 0) return;

        const monologueEntry = monologues[getRandomInt(0, monologues.length - 1)];
        const monologue = monologueEntry.Text;
        const imageState = monologueEntry.Image;

        setMascotImage(imageState);
        showMascotBubble(monologue);

        await sleep(getRandomInt(3, 6) * 1000);
        hideBubbles();
        setMascotImage("default");
    }

    function increaseMood(amount) {
        currentMood = Math.min(MOOD_MAX, currentMood + amount);
        updateMascotMood();
    }

    function decreaseMood(amount) {
        currentMood = Math.max(MOOD_MIN, currentMood - amount);
        updateMascotMood();
    }

    function updateMascotMood() {
        // 気分に応じて何かする (例: アイドルアニメーションの頻度調整など)
    }

    function getMascotImageBasedOnMood() {
        if (currentMood > 90) {
            return "love";
        } else if (currentMood > 70) {
            return "happy";
        } else if (currentMood < 10) {
            return "angry";
        } else if (currentMood < 30) {
            return "sad";
        } else {
            return "default";
        }
    }

    function setMascotImage(state) {
        let imageName = "";
        let mascotPrefix = "";

        if (currentMascot === "Lumina") {
            mascotPrefix = "Lumina";
        } else if (currentMascot === "Planet") {
            mascotPrefix = "planet";
        } else { // Mascot (デフォルト)
            mascotPrefix = "mascot";
        }

        if (state === "default") {
            imageName = `${mascotPrefix}.png`;
        } else {
            imageName = `${mascotPrefix}_${state}.png`;
        }

        const imagePath = `mascot_image_priset/${currentMascot}/${imageName}`;
        characterImage.src = imagePath;

        // 画像が見つからなかった場合のフォールバック
        characterImage.onerror = () => {
            const fallbackPath = `mascot_image_priset/${currentMascot}/${mascotPrefix}.png`;
            characterImage.src = fallbackPath;
            characterImage.onerror = null; // 無限ループを防ぐ
        };
    }

    function showContextMenu(e) {
        contextMenu.style.display = 'block';
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
    }

    function handleConversation(userPrompt, responseCategory, imageState) {
        showUserBubble(userPrompt);
        const mascotResponses = messages[currentMascot]?.[responseCategory] || ["ごめんなさい、よくわかりません。"];
        const mascotResponse = mascotResponses[getRandomInt(0, mascotResponses.length - 1)];
        showMascotBubble(mascotResponse);
        setMascotImage(imageState);
        clearTimeout(autoHideTimer);
        autoHideTimer = setTimeout(hideBubbles, 10000);
    }

    function getTimeMessage() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeString = `${hours}:${minutes}`;

        const timeMessages = messages[currentMascot]?.Time || ["現在時刻は {0} です。"];
        const randomTimeMessage = timeMessages[getRandomInt(0, timeMessages.length - 1)];
        return randomTimeMessage.replace('{0:HH:mm}', timeString);
    }

    // ヘルパー関数
    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    initialize();
});