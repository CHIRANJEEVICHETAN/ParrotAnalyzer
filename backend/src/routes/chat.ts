import express, { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import { pool } from '../config/database';

const router = express.Router();

// Update the SYSTEM_PROMPT to be more concise
const SYSTEM_PROMPT = `You are an assistant for the "Parrot Analyzer" app.

Focus on:
- Time tracking and attendance
- Expense reports and claims
- Leave management
- Profile settings
- Technical support

Format responses:
- Use **bold** for headers
- Use - for bullet points
- Keep responses brief`;

// Custom responses for specific queries
const CUSTOM_RESPONSES: { [key: string]: string } = {
  "How do I track my work hours or how to i track my attendance?": 
    "**1. Start Shift**\n" +
    "- Open app and tap 'Start Shift', allow location\n\n" +
    "**2. End Shift**\n" +
    "- Tap 'End Shift' and review summary\n\n" +
    "**3. History**\n" +
    "- View records in 'Shift History'",

  "How do I contact support?":
    "**1. Help & Support**\n" +
    "- Email: parrotanalyzer@gmail.com\n" +
    "- Phone: +916363451047",

  "How do I submit an expense report?":
    "**1. Create Expense**\n" +
    "- Go to Expenses and fill details with receipt\n\n" +
    "**2. Submit**\n" +
    "- Review details and submit for approval",

  "How do I request leave?":
    "**1. Leave Request**\n" +
    "- Go to Leave section and fill details\n\n" +
    "**2. Submit & Track**\n" +
    "- Submit request and check status in History",

  "How do I update my profile information?":
    "**1. Profile**\n" +
    "- Go to Profile and update your details\n\n" +
    "**2. Save**\n" +
    "- Confirm changes to update profile",

  "How do I reset my password?":
    "**1. Password Reset**\n" +
    "- Go to Settings > Change Password\n\n" +
    "**2. Update**\n" +
    "- Enter old and new password, save changes",

  "How do I submit a travel expense?":
    "**1. Travel Expense**\n" +
    "- Enter trip details and add receipts\n\n" +
    "**2. Submit**\n" +
    "- Review and submit for approval",

  "How do I log out of the app?":
    "**1. Logout**\n" +
    "- Go to Settings and tap Logout\n\n" +
    "**2. Login**\n" +
    "- Use credentials to login again",

  "How do I know my assigned Group Admin?":
    "**1. Admin Info**\n" +
    "- Check Profile Details for admin contact\n\n" +
    "**2. Contact**\n" +
    "- Use provided contact information",

  "How do I know if my expense report is approved?":
    "**1. Status**\n" +
    "- Check Expense History for approval status\n\n" +
    "**2. Follow-up**\n" +
    "- Contact admin for pending approvals",

  "Why is my shift not being recorded?":
    "**1. Check**\n" +
    "- Verify location access and internet connection\n\n" +
    "**2. Resolve**\n" +
    "- Restart app or contact support if issue persists"
};

// Add this after CUSTOM_RESPONSES definition
const SUGGESTED_QUESTIONS = [
  "How do I track my work hours or how to i track my attendance?",
  "How do I submit an expense report?",
  "How do I request leave?",
  "How do I update my profile information?",
  "How do I reset my password?",
  "How do I contact support?",
  "How do I submit a travel expense?",
  "How do I log out of the app?",
  "How do I know my assigned Group Admin?",
  "How do I know if my expense report is approved?",
  "Why is my shift not being recorded?"
];

// Update the OFF_TOPIC_RESPONSE to be more concise
const OFF_TOPIC_RESPONSE = 
  "I can help you with:\n" +
  "- **Time Tracking**\n" +
  "- **Expenses**\n" +
  "- **Leave**\n" +
  "- **Profile**\n" +
  "- **Support**\n\n" +
  "Please ask about these topics.";

// Add this function at the top with other constants
const CHAT_TIMEOUT_MINUTES = 30;

// Initialize Gemini AI
if (!process.env.GOOGLE_GEMINI_API_KEY) {
  console.error('GOOGLE_GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Update the appKeywords to include more variations and topics
const appKeywords = [
  // Time tracking related
  'time', 'hours', 'attendance', 'shift', 'clock', 'work',
  // Expense related
  'expense', 'claim', 'report', 'travel', 'reimbursement', 'money',
  // Leave related
  'leave', 'vacation', 'holiday', 'off', 'absence', 'sick',
  // Profile related
  'profile', 'account', 'password', 'settings', 'details', 'information',
  // Support related
  'help', 'support', 'issue', 'problem', 'error', 'contact',
  // Admin related
  'admin', 'supervisor', 'manager', 'approval', 'approve',
  // Common actions
  'how', 'where', 'what', 'when', 'why', 'can', 'need', 'want'
];

// Add this helper function to calculate string similarity
const calculateSimilarity = (str1: string, str2: string): number => {
  const words1 = str1.toLowerCase().split(/\s+/);
  const words2 = str2.toLowerCase().split(/\s+/);
  
  // Count matching words
  const matches = words1.filter(word => words2.includes(word));
  
  // Calculate similarity score
  return matches.length / Math.max(words1.length, words2.length);
};

// Update findMatchingResponse to be more precise and avoid duplicates
const findMatchingResponse = (userMessage: string): string | null => {
  const message = userMessage.toLowerCase();
  
  // First check if it's completely off-topic
  const isAppRelated = appKeywords.some(keyword => 
    message.includes(keyword.toLowerCase())
  );

  if (!isAppRelated) {
    return OFF_TOPIC_RESPONSE;
  }

  // First try exact matches
  for (const [question, response] of Object.entries(CUSTOM_RESPONSES)) {
    const similarity = calculateSimilarity(message, question);
    if (similarity >= 0.5) {
      return response;
    }
  }

  // Single matching block for each category to avoid duplicates
  if (message.includes('expense') || message.includes('report')) {
    if (message.includes('travel')) {
      return CUSTOM_RESPONSES["How do I submit a travel expense?"];
    }
    if (message.includes('status') || message.includes('approved')) {
      return CUSTOM_RESPONSES["How do I know if my expense report is approved?"];
    }
    if (message.includes('submit') || message.includes('file') || message.includes('new')) {
      return CUSTOM_RESPONSES["How do I submit an expense report?"];
    }
  }

  if (message.includes('admin') || message.includes('supervisor')) {
    return CUSTOM_RESPONSES["How do I know my assigned Group Admin?"];
  }

  if (message.includes('shift') || message.includes('attendance') || message.includes('time')) {
    if (message.includes('not') || message.includes('issue')) {
      return CUSTOM_RESPONSES["Why is my shift not being recorded?"];
    }
    return CUSTOM_RESPONSES["How do I track my work hours or how to i track my attendance?"];
  }

  if (message.includes('leave') || message.includes('vacation')) {
    return CUSTOM_RESPONSES["How do I request leave?"];
  }

  if (message.includes('support') || message.includes('help') || message.includes('contact')) {
    return CUSTOM_RESPONSES["How do I contact support?"];
  }

  return OFF_TOPIC_RESPONSE;
};

router.post('/send-message', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    const { message } = req.body;
    const userId = req.user?.id;

    if (!userId || !message) {
      return res.status(400).json({ error: 'User ID and message are required' });
    }

    // First check exact matches
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

    // Check for similar questions or off-topic
    const matchingResponse = findMatchingResponse(message);
    if (matchingResponse) {
      await pool.query(
        `INSERT INTO chat_messages (user_id, message, response, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING *`,
        [userId, message, matchingResponse]
      );
      return res.json({ message: matchingResponse });
    }

    // If no matching response found, return the OFF_TOPIC_RESPONSE
    await pool.query(
      `INSERT INTO chat_messages (user_id, message, response, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, message, OFF_TOPIC_RESPONSE]
    );
    return res.json({ message: OFF_TOPIC_RESPONSE });

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
       AND created_at > NOW() - INTERVAL '${CHAT_TIMEOUT_MINUTES} minutes'
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

router.get('/suggested-questions', verifyToken, async (_req: CustomRequest, res: Response) => {
  try {
    res.json({ 
      questions: SUGGESTED_QUESTIONS,
      // Include example response format to show structure
      exampleResponse: {
        format: "1. **Step Title**\n" +
                "   - Action detail\n\n" +
                "2. **Next Step**\n" +
                "   - Action detail"
      }
    });
  } catch (error) {
    console.error('Error fetching suggested questions:', error);
    res.status(500).json({ error: 'Failed to fetch suggested questions' });
  }
});

// Add a new cleanup endpoint that can be called periodically
router.delete('/cleanup-old-messages', verifyToken, async (req: CustomRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    await pool.query(
      `DELETE FROM chat_messages 
       WHERE user_id = $1 
       AND created_at < NOW() - INTERVAL '${CHAT_TIMEOUT_MINUTES} minutes'`,
      [userId]
    );

    res.json({ message: 'Old messages cleaned up successfully' });
  } catch (error) {
    console.error('Error cleaning up old messages:', error);
    res.status(500).json({ error: 'Failed to cleanup old messages' });
  }
});

export default router; 