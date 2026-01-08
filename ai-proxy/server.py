from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gpt-oss:latest")

@app.route('/v1/ai/text-to-diagram/generate', methods=['POST'])
def text_to_diagram():
    data = request.json
    prompt = data.get('prompt', '')

    response = requests.post(f"{OLLAMA_URL}/v1/chat/completions", json={
        'model': OLLAMA_MODEL,
        'messages': [
            {
                'role': 'system',
                'content': '''You are a Mermaid diagram expert. Generate ONLY valid Mermaid syntax.
No explanations, no markdown code blocks, just raw Mermaid code.
Start directly with the diagram type (flowchart, sequenceDiagram, classDiagram, etc).'''
            },
            {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.7
    })

    if response.status_code != 200:
        return jsonify({'error': 'Ollama request failed'}), 500

    result = response.json()
    mermaid_code = result['choices'][0]['message']['content']

    mermaid_code = mermaid_code.strip()
    if mermaid_code.startswith('```'):
        lines = mermaid_code.split('\n')
        mermaid_code = '\n'.join(lines[1:-1] if lines[-1] == '```' else lines[1:])

    return jsonify({
        'generatedResponse': mermaid_code
    }), 200, {
        'X-Ratelimit-Limit': '100',
        'X-Ratelimit-Remaining': '99'
    }


@app.route('/v1/ai/diagram-to-code/generate', methods=['POST'])
def diagram_to_code():
    data = request.json
    texts = data.get('texts', [])
    image = data.get('image', '')
    theme = data.get('theme', 'light')

    messages = [
        {
            'role': 'system',
            'content': f'''You are a frontend developer. Convert the wireframe/mockup into clean HTML/CSS.
Theme: {theme}
Generate a complete, self-contained HTML document with inline CSS.
Make it responsive and modern-looking.'''
        },
        {
            'role': 'user',
            'content': [
                {'type': 'text', 'text': f'Texts in the diagram: {", ".join(texts)}'},
                {'type': 'image_url', 'image_url': {'url': image}}
            ]
        }
    ]

    response = requests.post(f"{OLLAMA_URL}/v1/chat/completions", json={
        'model': OLLAMA_MODEL,
        'messages': messages,
        'temperature': 0.7
    })

    if response.status_code != 200:
        return jsonify({'error': 'Ollama request failed'}), 500

    result = response.json()
    html_code = result['choices'][0]['message']['content']

    if '```html' in html_code:
        start = html_code.find('```html') + 7
        end = html_code.find('```', start)
        html_code = html_code[start:end].strip()
    elif '```' in html_code:
        start = html_code.find('```') + 3
        end = html_code.find('```', start)
        html_code = html_code[start:end].strip()

    return jsonify({'html': html_code})


if __name__ == '__main__':
    print(f"Starting AI proxy on port 3015")
    print(f"Using Ollama at {OLLAMA_URL} with model {OLLAMA_MODEL}")
    app.run(host='0.0.0.0', port=3015, debug=True)
