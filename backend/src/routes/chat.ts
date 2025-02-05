import express, { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import { pool } from '../config/database';

const router = express.Router();

const SYSTEM_PROMPT = `You are an expert assistant for the "Parrot Analyzer" project—a subscription-based, multi-tenant mobile application designed for employee tracking, attendance management, travel analytics, and expense reporting. 

Core Features:
- Employee shift logging with GPS tracking
- Real-time location monitoring
- Expense management with AI categorization
- Travel distance calculation with geofencing
- Task management and status updates
- Role-based access control

When responding:
1. Be concise and clear
2. Focus on practical, step-by-step instructions
3. Reference specific app features and UI elements
4. Maintain a helpful, professional tone
5. Format responses in markdown for better readability

Current context: You are providing live chat support to employees using the Parrot Analyzer app.`;

// Custom responses for specific queries
const CUSTOM_RESPONSES: { [key: string]: string } = {
  "How do I track my work hours?": 
    "Here's how to track your work hours in Parrot Analyzer:\n\n" +
    "1. **Start Shift**\n" +
    "   - Open the app and tap the 'Start Shift' button\n" +
    "   - Allow location access when prompted\n\n" +
    "2. **During Your Shift**\n" +
    "   - The app automatically tracks your location\n" +
    "   - Indoor movements are filtered using geofencing\n\n" +
    "3. **End Shift**\n" +
    "   - Tap 'End Shift' when done\n" +
    "   - Review your shift summary\n\n" +
    "4. **View History**\n" +
    "   - Go to 'Shift History' to see past records\n" +
    "   - Check detailed analytics of your work hours\n\n" +
    "Need help with anything specific about shift tracking?",

  "How to submit travel expenses?":
    "Follow these steps to submit travel expenses:\n\n" +
    "1. **Access Expenses**\n" +
    "   - Open the app menu\n" +
    "   - Tap 'Expenses' → 'New Expense'\n\n" +
    "2. **Add Details**\n" +
    "   - Select 'Travel' category\n" +
    "   - Your travel distance is auto-calculated\n" +
    "   - Add expense amount\n\n" +
    "3. **Upload Receipts**\n" +
    "   - Tap 'Add Receipt'\n" +
    "   - Take photo or choose from gallery\n" +
    "   - Our AI will auto-categorize the receipt\n\n" +
    "4. **Submit**\n" +
    "   - Review all details\n" +
    "   - Tap 'Submit for Approval'\n\n" +
    "Would you like to know more about expense policies?",

  "What is geofencing and how does it work?":
    "Let me explain geofencing in Parrot Analyzer:\n\n" +
    "**What is Geofencing?**\n" +
    "- A virtual boundary around specific locations\n" +
    "- Helps distinguish between indoor and outdoor movement\n\n" +
    "**How it Works:**\n" +
    "1. The app creates virtual boundaries around:\n" +
    "   - Your workplace\n" +
    "   - Client locations\n" +
    "   - Other designated areas\n\n" +
    "2. Benefits:\n" +
    "   - Accurate travel distance calculation\n" +
    "   - Automatic shift status updates\n" +
    "   - Better expense tracking\n\n" +
    "Would you like to know how to view your geofenced locations?",
};

// Initialize Gemini AI
if (!process.env.GOOGLE_GEMINI_API_KEY) {
  console.error('GOOGLE_GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

router.post('/send-message', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    const { message } = req.body;
    const userId = req.user?.id;

    if (!userId || !message) {
      return res.status(400).json({ error: 'User ID and message are required' });
    }

    // Check for custom responses first
    if (CUSTOM_RESPONSES[message]) {
      const response = CUSTOM_RESPONSES[message];
      await pool.query(
        `INSERT INTO chat_messages (user_id, message, response, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING *`,
        [userId, message, response]
      );
      return res.json({ message: response });
    }

    // If no custom response, use Gemini AI with system prompt
    try {
      const chat = model.startChat({
        history: [
          {
            role: 'user',
            parts: [{ text: SYSTEM_PROMPT }]
          },
          {
            role: 'model',
            parts: [{ text: 'I understand and will provide support based on these guidelines.' }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.7,
        }
      });

      const result = await chat.sendMessage(message);
      const response = await result.response;
      const aiResponse = response.text();

      // Store in database
      const dbResponse = await pool.query(
        `INSERT INTO chat_messages (user_id, message, response, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING *`,
        [userId, message, aiResponse]
      );

      res.json({ 
        message: aiResponse,
        timestamp: dbResponse.rows[0].created_at 
      });
    } catch (aiError: any) {
      console.error('Gemini AI Error:', aiError);
      return res.status(500).json({ 
        error: 'AI Service Error', 
        details: aiError.message 
      });
    }
  } catch (error: any) {
    console.error('Server Error:', error);
    res.status(500).json({ 
      error: 'Server Error', 
      details: error.message 
    });
  }
});

router.get('/history', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT message, response, created_at
       FROM chat_messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

export default router; 