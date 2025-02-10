import express, { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import { pool } from '../config/database';

const router = express.Router();

const SYSTEM_PROMPT = `You are an expert assistant for the "Parrot Analyzer" project. 

When formatting responses:
1. Use **bold** for important terms and section titles
2. Use bullet points (-) for lists
3. Use numbered lists (1.) for step-by-step instructions
4. Add line breaks between sections (\n\n)
5. Keep responses concise and well-structured

For these specific questions, use exactly these responses:

1. For logout questions:
- How to access: Go to Settings
- Select Logout option
- Can log back in with credentials

2. For Group Admin queries:
- Check Profile Details section
- Find Admin name and contact info
- Contact them for queries/adjustments

3. For expense approval status:
- Check Expense History
- View status (pending/approved/rejected)
- Contact Admin if needed

4. For shift recording issues:
- Verify location permissions
- Check internet connection
- Try restarting the app
- Contact support if persists

Current context: You are providing live chat support to employees using the Parrot Analyzer app.`;

// Custom responses for specific queries
const CUSTOM_RESPONSES: { [key: string]: string } = {
  "How do I track my work hours or how to i track my attendance?": 
    "**1. Start Your Shift**\n" +
    "- Open the app and locate the prominent 'Start Shift' button\n" +
    "- Allow location access when prompted\n\n" +
    "**2. During Your Shift**\n" +
    "- Your location is automatically tracked\n" +
    "- Indoor movements are filtered using geofencing\n\n" +
    "**3. End Your Shift**\n" +
    "- Tap 'End Shift' when you're done\n" +
    "- Review your shift summary\n\n" +
    "**4. View Your History**\n" +
    "- Access 'Shift History' for past records\n" +
    "- Check detailed analytics of your work hours",

  "How do I submit an expense report?":
    "**1. Access Expenses**\n" +
    "- Open the app and go to 'Expenses' section\n\n" +
    "**2. Add Your Expense Details**\n" +
    "- Enter the amount\n" +
    "- Select expense category\n" +
    "- Add description\n" +
    "- Upload receipt (if required)\n\n" +
    "**3. Submit for Approval**\n" +
    "- Review all details\n" +
    "- Tap 'Submit' button\n\n" +
    "**4. Track Your Submission**\n" +
    "- Monitor status in 'Expense History'\n" +
    "- Check for any approval updates",

  "How do I request leave?":
    "**1. Navigate to Leave Section**\n" +
    "- Open app and go to 'Leave Requests'\n\n" +
    "**2. Fill Leave Details**\n" +
    "- Select leave type\n" +
    "- Choose start and end dates\n" +
    "- Provide reason for leave\n\n" +
    "**3. Submit Your Request**\n" +
    "- Review all details\n" +
    "- Tap 'Submit' for approval\n\n" +
    "**4. Monitor Status**\n" +
    "- Track in 'Leave History'\n" +
    "- Check approval status",

  "How do I update my profile information?":
    "1. **Go to Profile**\n" +
    "   - Open the app and tap on 'Profile' from the menu\n\n" +
    "2. **Edit Information**\n" +
    "   - Update personal details like phone number and email\n\n" +
    "3. **Save Changes**\n" +
    "   - Tap 'Save' to update your profile information",

  "How do I reset my password?":
    "1. **Go to Settings**\n" +
    "   - Open the app and navigate to 'Settings'\n\n" +
    "2. **Change Password**\n" +
    "   - Select 'Change Password' and enter the current and new password\n\n" +
    "3. **Confirm Update**\n" +
    "   - Tap 'Save' to reset your password",

  "How do I contact support?":
    "1. **Go to Help & Support**\n" +
    "   - Open the app and navigate to 'Help & Support'\n\n" +
    "2. **Choose a Contact Method**\n" +
    "   - Email: parrotanalyzer@gmail.com\n" +
    "   - Phone: +916363451047\n\n" +
    "3. **Submit a Ticket**\n" +
    "   - Fill in your issue details and tap 'Submit' to get assistance",

  "How do I submit a travel expense?":
    "1. **Go to Travel Expenses**\n" +
    "   - Open the app and navigate to 'Travel Expenses' section\n\n" +
    "2. **Add Travel Details**\n" +
    "   - Enter travel date, distance, and purpose\n" +
    "   - Add any related expenses (fuel, toll, etc.)\n\n" +
    "3. **Attach Documents**\n" +
    "   - Upload receipts and supporting documents\n\n" +
    "4. **Submit Report**\n" +
    "   - Review details and tap 'Submit' for approval",

  "How do I log out of the app?":
    "1. **Go to Settings**\n" +
    "   - Open the app and navigate to 'Settings.'\n\n" +
    "2. **Tap Logout**\n" +
    "   - Select 'Logout' to exit your account securely.\n\n" +
    "3. **Re-login if Needed**\n" +
    "   - Use your credentials to log in again anytime.",

  "How do I know my assigned Group Admin?":
    "1. **Go to Profile**\n" +
    "   - Open the app and navigate to 'Profile Details.'\n\n" +
    "2. **Check Admin Details**\n" +
    "   - Your assigned Group Admin's name and contact will be listed.\n\n" +
    "3. **Contact Admin**\n" +
    "   - Reach out for any queries or shift adjustments.",

  "How do I know if my expense report is approved?":
    "1. **Go to Expenses**\n" +
    "   - Open the app and navigate to 'Expense History.'\n\n" +
    "2. **Check Status**\n" +
    "   - View pending, approved, or rejected expenses.\n\n" +
    "3. **Contact Admin**\n" +
    "   - If needed, reach out to your Group Admin for updates.",

  "Why is my shift not being recorded?":
    "1. **Check Location Permissions**\n" +
    "   - Ensure the app has location access enabled.\n\n" +
    "2. **Ensure Internet Connectivity**\n" +
    "   - A stable internet connection is required for tracking.\n\n" +
    "3. **Restart the App**\n" +
    "   - Close and reopen the app to refresh tracking.\n\n" +
    "4. **Contact Support**\n" +
    "   - If the issue persists, reach out via 'Help & Support.'"
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

// Update the OFF_TOPIC_RESPONSE to use markdown
const OFF_TOPIC_RESPONSE = 
  "I'm specifically designed to help with **Parrot Analyzer** app features.\n\n" +
  "I can help you with:\n" +
  "- **Time Tracking**: Attendance and work hours\n" +
  "- **Expenses**: Reports and travel claims\n" +
  "- **Leave Management**: Requests and status\n" +
  "- **Profile Settings**: Updates and passwords\n" +
  "- **Technical Support**: App-related assistance\n\n" +
  "How can I assist you with any of these topics?";

// Add this function at the top with other constants
const CHAT_TIMEOUT_MINUTES = 30;

// Initialize Gemini AI
if (!process.env.GOOGLE_GEMINI_API_KEY) {
  console.error('GOOGLE_GEMINI_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Add these keywords to the appKeywords array
const appKeywords = [
  'logout', 'sign out', 
  'group admin', 'supervisor', 'manager',
  'expense status', 'approved', 'rejected',
  'shift recording', 'tracking issue', 'location'
];

// Add this function to help match similar questions
const findMatchingResponse = (userMessage: string): string | null => {
  const message = userMessage.toLowerCase();

  // Logout related queries
  if (message.includes('logout') || message.includes('sign out')) {
    return CUSTOM_RESPONSES["How do I log out of the app?"];
  }

  // Group Admin related queries
  if (message.includes('group admin') || message.includes('supervisor') || 
      message.includes('who is my admin')) {
    return CUSTOM_RESPONSES["How do I know my assigned Group Admin?"];
  }

  // Expense approval related queries
  if ((message.includes('expense') || message.includes('report')) && 
      (message.includes('status') || message.includes('approved'))) {
    return CUSTOM_RESPONSES["How do I know if my expense report is approved?"];
  }

  // Shift recording issues
  if ((message.includes('shift') || message.includes('attendance')) && 
      (message.includes('not working') || message.includes('issue') || 
       message.includes('problem') || message.includes('recording'))) {
    return CUSTOM_RESPONSES["Why is my shift not being recorded?"];
  }

  return null;
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

    // Then check for similar questions using the new function
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

    // Check if the message is app-related using keywords
    const isAppRelated = appKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );

    if (!isAppRelated) {
      await pool.query(
        `INSERT INTO chat_messages (user_id, message, response, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING *`,
        [userId, message, OFF_TOPIC_RESPONSE]
      );
      return res.json({ message: OFF_TOPIC_RESPONSE });
    }

    // Only uses Gemini AI if no custom response is found
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