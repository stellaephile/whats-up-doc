# Amazon Polly Voice Integration
**What's Up Doc — Voice Readout Feature**
Date: March 8, 2026 | Est. build time: 45 min

---

## What It Does

After hospital results load, a voice button reads out the top result:

**English:**
> "Emergency detected. Nearest hospital: Apollo Clinic, 1.4 kilometres away. Emergency department available. Call 011-26588500."

**Hindi:**
> "Achintak sthiti. Sabse paas ka aspatal: Apollo Clinic, 1.4 kilometre door. Emergency vibhag uplabdh hai. Phone karein 011-26588500."

Language auto-switches based on what the user typed — Hindi/Hinglish input → Hindi voice, English input → English voice.

---

## Why It Wins Points

| Criteria | How Polly helps |
|----------|----------------|
| Technical Excellence (30%) | Adds a 5th AWS service — Bedrock + RDS + EB + Amplify + Location + **Polly** |
| Innovation (30%) | Voice in a medical app is rare; voice in Hindi for rural India is novel |
| Impact & Relevance (25%) | India has 25% functional illiteracy — voice bridges the gap |
| Presentation (15%) | Judges hear it in the demo video — instantly memorable |

---

## Architecture

```
User sees results
      │
      ▼
 [🔊 Play] button appears on result card
      │
      ▼
 Frontend calls POST /api/polly
      │
      ▼
 Node server calls AWS Polly SDK
   • English → Voice: "Kajal" (Indian English, Neural)
   • Hindi   → Voice: "Kajal" (Hindi, Neural) — same voice, both languages
      │
      ▼
 Returns audio/mpeg stream
      │
      ▼
 Browser plays via <audio> element
```

**Why server-side, not client-side Polly?**
- AWS credentials never exposed to browser
- Response can be cached (same hospital text = same audio)
- Simpler — one SDK call, stream back

---

## Voices

| Language | Voice ID | Engine | Notes |
|----------|----------|--------|-------|
| English (Indian) | `Kajal` | Neural | Indian accent, warm tone |
| Hindi | `Kajal` | Neural | Same voice ID works for both |

Kajal is AWS's only bilingual Indian English + Hindi neural voice — perfect for this use case.

---

## Text Template

### Emergency
```
English:
"Emergency alert. Nearest hospital: {name}, {distance} kilometres away.
Emergency department available. Call {phone}. Call 1-0-8 for ambulance."

Hindi:
"Achintak sthiti. Sabse paas ka aspatal {name}, {distance} kilometre door hai.
Emergency vibhag uplabdh hai. Phone karein {phone}. Ambulance ke liye 1-0-8 dialaein."
```

### Non-Emergency
```
English:
"Results found. Nearest hospital: {name}, {distance} kilometres away.
{emergency_text}. Call {phone} for appointment."

Hindi:
"Aspatal mila. Sabse paas: {name}, {distance} kilometre door.
{emergency_text}. Appointment ke liye phone karein {phone}."
```

---

## Files to Create / Modify

```
backend/
└── server.js          ← ADD: POST /api/polly route (~40 lines)

frontend/
└── AppWithSymptoms.js ← ADD: SpeakButton component + call /api/polly (~60 lines)
```

No new files needed beyond these two changes.

---

## Backend: POST /api/polly

```javascript
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');

const pollyClient = new PollyClient({ region: process.env.AWS_REGION || 'ap-south-1' });

app.post('/api/polly', async (req, res) => {
  const { text, language = 'en' } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const command = new SynthesizeSpeechCommand({
    Text:         text,
    VoiceId:      'Kajal',
    Engine:       'neural',
    OutputFormat: 'mp3',
    LanguageCode: language === 'hi' ? 'hi-IN' : 'en-IN',
  });

  const response = await pollyClient.send(command);
  res.set('Content-Type', 'audio/mpeg');
  response.AudioStream.pipe(res);
});
```

---

## Frontend: SpeakButton Component

```jsx
function SpeakButton({ hospital, language, severityLevel }) {
  const [playing, setPlaying]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const audioRef                = useRef(null);

  const buildText = () => {
    const dist  = hospital.distance_km?.toFixed(1) || '?';
    const name  = hospital.hospital_name;
    const phone = hospital.emergency_num || hospital.telephone || 'not available';
    const isEm  = severityLevel === 'emergency';

    if (language === 'hi') {
      return isEm
        ? `Achintak sthiti. Sabse paas ka aspatal ${name}, ${dist} kilometre door hai. Emergency vibhag uplabdh hai. Phone karein ${phone}. Ambulance ke liye ek sau aath dialaein.`
        : `Aspatal mila. Sabse paas: ${name}, ${dist} kilometre door. Phone karein ${phone}.`;
    }
    return isEm
      ? `Emergency alert. Nearest hospital: ${name}, ${dist} kilometres away. Emergency department available. Call ${phone}. Dial 1-0-8 for ambulance.`
      : `Results found. Nearest hospital: ${name}, ${dist} kilometres away. Call ${phone} for appointment.`;
  };

  const speak = async () => {
    if (playing) { audioRef.current?.pause(); setPlaying(false); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/api/polly`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: buildText(), language }),
      });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      audioRef.current  = new Audio(url);
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.play();
      setPlaying(true);
    } catch (e) {
      console.error('Polly error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={speak} className="...">
      {loading ? '...' : playing ? '⏹ Stop' : '🔊 Listen'}
    </button>
  );
}
```

---

## Placement in UI

```
┌─────────────────────────────────────────┐
│  🏥 Apollo Clinic              1.4 km   │
│  Emergency ✓  |  Govt  |  200 beds      │
│  011-26588500                           │
│                                         │
│  [🔊 Listen]  [📞 Call]  [🗺 Directions] │
└─────────────────────────────────────────┘
```

`Listen` button appears on the **first result card only** — keeps it clean, highlights the most important result.

---

## IAM Permissions Needed

Add to your EB instance role (or Lambda execution role):

```json
{
  "Effect": "Allow",
  "Action": ["polly:SynthesizeSpeech"],
  "Resource": "*"
}
```

---

## What to Demo

**Scenario 1 — English emergency:**
Type "chest pain" → results load → click Listen →
*"Emergency alert. Nearest hospital: AIIMS Delhi, 2.1 kilometres away..."*

**Scenario 2 — Hindi:**
Type "seena dard" → results load → click Listen →
*"Achintak sthiti. Sabse paas ka aspatal..."* (Hindi voice)

**Scenario 3 — Non-emergency:**
Type "fever since 2 days" → results load → click Listen →
*"Results found. Nearest hospital: City Clinic, 0.8 kilometres away..."*

---

## Risk

| Risk | Mitigation |
|------|-----------|
| Polly call fails | Button silently hides if API errors — doesn't break main flow |
| IAM not set up in time | Can demo with pre-recorded audio as fallback |
| Hindi text sounds off | Test 3 phrases before demo, adjust transliteration if needed |

---

*Estimated build: 45 minutes | AWS service added: Amazon Polly (Neural TTS)*