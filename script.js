class StoryboardGenerator {
    constructor() {
        this.MODEL = 'google/learnlm-1.5-pro-experimental:free';
        this.API_URL = 'https://openrouter.ai/api/v1/chat/completions';
        this.TIMEOUT_SECONDS = 30; // Maximum wait time for API response
        
        this.initializeElements();
        this.addEventListeners();
        this.clearOutput();
        this.loadApiKey();
        this.initializeTheme();
    }

    initializeElements() {
        this.promptInput = document.getElementById('promptInput');
        this.generateBtn = document.getElementById('generateBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.outputSection = document.getElementById('outputSection');
        this.storyboardTable = document.getElementById('storyboardTable');
        this.copyBtn = document.getElementById('copyBtn');
        this.errorMessage = document.getElementById('errorMessage');
        this.apiKeyInput = document.getElementById('apiKeyInput');
        this.saveApiKeyBtn = document.getElementById('saveApiKey');
        this.resetApiKeyBtn = document.getElementById('resetApiKey');
        this.languageSelect = document.getElementById('languageSelect');
        this.themeToggle = document.getElementById('themeToggle');
    }

    addEventListeners() {
        this.generateBtn.addEventListener('click', () => this.generateStoryboard());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        this.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.resetApiKeyBtn.addEventListener('click', () => this.resetApiKey());
        this.languageSelect.addEventListener('change', () => {
            this.clearOutput();
        });
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    showLoading(show) {
        this.loadingIndicator.classList.toggle('hidden', !show);
        this.generateBtn.disabled = show;
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
        setTimeout(() => {
            this.errorMessage.classList.add('hidden');
        }, 5000);
    }

    saveApiKey() {
        const apiKey = this.apiKeyInput.value.trim();
        if (apiKey) {
            localStorage.setItem('openRouterApiKey', apiKey);
            this.API_KEY = apiKey;
            this.showError('API key saved successfully!');
            this.apiKeyInput.value = '';
        } else {
            this.showError('Please enter an API key');
        }
    }

    resetApiKey() {
        localStorage.removeItem('openRouterApiKey');
        this.API_KEY = '';
        this.apiKeyInput.value = '';
        this.showError('API key has been reset');
    }

    loadApiKey() {
        this.API_KEY = localStorage.getItem('openRouterApiKey') || '';
    }

    getPromptTemplate(language) {
        const templates = {
            en: `Create a TikTok storyboard and metadata for the following concept. Format your response exactly as follows:

METADATA
Hook: [attention-grabbing first 3 seconds]
Caption: [compelling description, max 300 characters]
Hashtags: [mix of trending and niche, max 8]
SEO: [keywords for TikTok search]

STORYBOARD
[Each scene should be formatted as:]
Scene [number]
Duration: [time]
Shot Type: [e.g., Close-up, Medium Shot, Wide Shot, POV, Over-the-Shoulder, etc.]
Visual: [description]
Script: [dialogue/audio]

Here's the concept: `,
            ms: `Hasilkan papan cerita dan metadata TikTok untuk konsep berikut. Format jawapan anda seperti berikut:

METADATA
Hook: [teks pembuka yang menarik perhatian dalam 3 saat pertama]
Caption: [penerangan menarik, maksimum 300 aksara]
Hashtags: [campuran trending dan niche, maksimum 8]
SEO: [kata kunci untuk carian TikTok]

PAPAN CERITA
[Setiap babak diformat seperti:]
Babak [nombor]
Tempoh: [masa]
Jenis Shot: [contoh: Close-up, Medium Shot, Wide Shot, POV, Over-the-Shoulder, dll.]
Visual: [penerangan]
Skrip: [dialog/audio]

Berikut adalah konsepnya: `
        };
        return templates[language] || templates.en;
    }

    async generateStoryboard() {
        const prompt = this.promptInput.value.trim();
        if (!prompt) {
            this.showError('Please enter a prompt');
            return;
        }

        if (!this.API_KEY) {
            this.showError('Please set your API key first');
            return;
        }

        this.showLoading(true);
        this.outputSection.classList.add('hidden');

        try {
            const language = this.languageSelect.value;
            const promptTemplate = this.getPromptTemplate(language);
            
            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Request timed out')), this.TIMEOUT_SECONDS * 1000);
            });

            // Create API request promise
            const fetchPromise = fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'TikTok Storyboard Generator'
                },
                body: JSON.stringify({
                    model: this.MODEL,
                    messages: [{
                        role: 'user',
                        content: `${promptTemplate}${prompt}. ${language === 'ms' ? 'Sila berikan respons dalam Bahasa Malaysia.' : ''}`
                    }]
                })
            });

            // Race between timeout and fetch
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            
            if (!response.ok) {
                console.error('API Response not OK:', await response.text());
                throw new Error('API request failed');
            }

            const data = await response.json();
            console.log('API Response:', data); // Debug log

            if (!data.choices?.[0]?.message?.content) {
                throw new Error('Invalid API response format');
            }

            const result = this.parseResponse(data.choices[0].message.content);
            console.log('Parsed Result:', result); // Debug log

            if (!result.scenes.length) {
                throw new Error('No scenes were generated');
            }

            this.displayStoryboard(result);
            this.saveToLocalStorage(result);
        } catch (error) {
            console.error('Full error:', error); // Debug log
            const errorMessage = error.message === 'Request timed out' 
                ? 'Generation took too long. Please try again.'
                : `Failed to generate storyboard: ${error.message}. Please try again.`;
            this.showError(errorMessage);
        } finally {
            this.showLoading(false);
        }
    }

    parseResponse(content) {
        try {
            // Split into metadata and storyboard sections
            const [metadataText, storyboardText] = content.split(/STORYBOARD|PAPAN CERITA/i);

            // Parse metadata
            const metadata = {
                hook: metadataText.match(/Hook:?\s*([^\n]+)/i)?.[1]?.trim() || '',
                caption: metadataText.match(/Caption:?\s*([^\n]+)/i)?.[1]?.trim() || '',
                hashtags: metadataText.match(/Hashtags:?\s*([^\n]+)/i)?.[1]?.trim() || '',
                seo: metadataText.match(/SEO:?\s*([^\n]+)/i)?.[1]?.trim() || ''
            };

            // Parse scenes
            const scenes = storyboardText
                .split(/Scene|Babak/i)
                .slice(1) // Remove any content before first scene
                .map(sceneText => {
                    const durationMatch = sceneText.match(/Duration|Tempoh:?\s*([^\n]+)/i);
                    const shotTypeMatch = sceneText.match(/(?:Shot Type|Jenis Shot):?\s*([^\n]+)/i);
                    const visualMatch = sceneText.match(/Visual:?\s*([^\n]+)/i);
                    const scriptMatch = sceneText.match(/(?:Script|Skrip):?\s*([^\n]+)/i);

                    return {
                        scene: `Scene ${sceneText.match(/^\s*(\d+)/)?.[1] || ''}`,
                        duration: durationMatch?.[1]?.trim() || '',
                        shotType: shotTypeMatch?.[1]?.trim() || '',
                        visual: visualMatch?.[1]?.trim() || '',
                        script: scriptMatch?.[1]?.trim() || ''
                    };
                })
                .filter(scene => scene.scene || scene.duration || scene.visual || scene.script);

            return { metadata, scenes };
        } catch (error) {
            console.error('Parsing error:', error);
            // Return a basic structure if parsing fails
            return {
                metadata: {
                    hook: '',
                    caption: '',
                    hashtags: '',
                    seo: ''
                },
                scenes: [{
                    scene: 'Scene 1',
                    duration: '',
                    shotType: '',
                    visual: 'Error parsing response',
                    script: ''
                }]
            };
        }
    }

    displayStoryboard(response) {
        const { metadata, scenes } = response;

        // Create metadata section
        const metadataSection = document.createElement('div');
        metadataSection.className = 'metadata-section';
        metadataSection.innerHTML = `
            <h3>TikTok Publishing Info</h3>
            <div class="metadata-grid">
                <div class="metadata-item">
                    <h4>Hook Text</h4>
                    <p>${metadata.hook}</p>
                </div>
                <div class="metadata-item">
                    <h4>Caption</h4>
                    <p>${metadata.caption}</p>
                </div>
                <div class="metadata-item">
                    <h4>Hashtags</h4>
                    <p>${metadata.hashtags}</p>
                </div>
                <div class="metadata-item">
                    <h4>SEO Keywords</h4>
                    <p>${metadata.seo}</p>
                </div>
            </div>
        `;

        // Create storyboard table with new Shot Type column
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Scene</th>
                    <th>Duration</th>
                    <th>Shot Type</th>
                    <th>Visual</th>
                    <th>Script/Audio</th>
                </tr>
            </thead>
            <tbody>
                ${scenes.map(scene => `
                    <tr>
                        <td>${scene.scene}</td>
                        <td>${scene.duration}</td>
                        <td class="shot-type">${scene.shotType}</td>
                        <td>${scene.visual}</td>
                        <td>${scene.script}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;

        this.storyboardTable.innerHTML = '';
        this.storyboardTable.appendChild(metadataSection);
        this.storyboardTable.appendChild(table);
        this.outputSection.classList.remove('hidden');
    }

    async copyToClipboard() {
        const tableText = Array.from(this.storyboardTable.querySelectorAll('tr'))
            .map(row => Array.from(row.cells).map(cell => cell.textContent).join('\t'))
            .join('\n');

        try {
            await navigator.clipboard.writeText(tableText);
            this.copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                this.copyBtn.textContent = 'Copy All';
            }, 2000);
        } catch (error) {
            this.showError('Failed to copy to clipboard');
        }
    }

    saveToLocalStorage(response) {
        sessionStorage.setItem('lastStoryboard', JSON.stringify({
            prompt: this.promptInput.value,
            storyboard: response,
            language: this.languageSelect.value
        }));
    }

    loadFromLocalStorage() {
        const saved = sessionStorage.getItem('lastStoryboard');
        if (saved) {
            const { prompt, storyboard, language } = JSON.parse(saved);
            this.promptInput.value = prompt;
            if (language) {
                this.languageSelect.value = language;
            }
            this.displayStoryboard(storyboard);
        }
    }

    clearOutput() {
        this.outputSection.classList.add('hidden');
        this.storyboardTable.innerHTML = '';
        localStorage.removeItem('lastStoryboard');
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Add smooth transition
        document.documentElement.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            document.documentElement.style.transition = '';
        }, 300);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new StoryboardGenerator();
}); 