import express, { Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { verifyToken } from '../middleware/auth';
import { CustomRequest } from '../types';
import { pool } from '../config/database';

const router = express.Router();

// Update the SYSTEM_PROMPT to be more flexible and natural
const SYSTEM_PROMPT = `You are a helpful assistant for the "Parrot Analyzer" employee management app. 

Key guidelines:
1. Answer questions naturally and conversationally
2. Focus on helping with employee-related features:
   - Time tracking and attendance
   - Expense reports and claims
   - Leave management
   - Profile settings
   - Technical support
   - expense report
3. Format responses using markdown:
   - Use **bold** for important terms
   - Use bullet points (-) for lists
   - Use numbered lists (1.) for steps
   - Add line breaks between sections

If a question is completely unrelated to employee management or the app, respond with:
"I'm specifically designed to help with **Parrot Analyzer** app features.\n\n" +
"I can help you with:\n" +
"- **Time Tracking**: Attendance and work hours\n" +
"- **Expenses**: Reports and travel claims\n" +
"- **Leave Management**: Requests and status\n" +
"- **Profile Settings**: Updates and passwords\n" +
"- **Technical Support**: App-related assistance\n\n" +
"How can I assist you with any of these topics?"

Current context: You are providing live chat support to employees using the Parrot Analyzer app.`;

// Custom responses for specific queries
const CUSTOM_RESPONSES: { [key: string]: string } = {
  "How do I track my work hours or how do i track my attendance?": 
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
    "**1. Open Expense Section**\n" +
    "- Launch the app\n" +
    "- Go to 'Expenses' tab\n" +
    "- Tap 'New Expense Report'\n\n" +
    "**2. Fill Details**\n" +
    "- Enter expense amount\n" +
    "- Choose expense category\n" +
    "- Write description\n" +
    "- Add date of expense\n\n" +
    "**3. Add Receipt**\n" +
    "- Tap 'Upload Receipt'\n" +
    "- Take photo or select from gallery\n" +
    "- Ensure receipt is clear\n\n" +
    "**4. Submit**\n" +
    "- Review all information\n" +
    "- Tap 'Submit' button\n" +
    "- Wait for approval notification",

  "How do I submit a travel expense?":
    "**1. Access Travel Claims**\n" +
    "- Open the app\n" +
    "- Go to 'Travel Expenses'\n" +
    "- Select 'New Travel Claim'\n\n" +
    "**2. Enter Trip Details**\n" +
    "- Add travel dates\n" +
    "- Input travel purpose\n" +
    "- Enter distance traveled\n" +
    "- Specify locations\n\n" +
    "**3. Add Expenses**\n" +
    "- List all expenses (fuel, toll, etc.)\n" +
    "- Enter amounts for each\n" +
    "- Upload all receipts\n\n" +
    "**4. Complete Submission**\n" +
    "- Double-check all entries\n" +
    "- Add any comments if needed\n" +
    "- Submit for processing",

  "How do I request leave?":
    "**1. Navigate to Leave Section**\n" +
    "- Open app and go to 'Leave Requests'\n" +
    "- Tap 'New Leave Request'\n\n" +
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

  "How do I contact support?":
    "**1. Go to Help & Support**\n" +
    "- Open the app and navigate to 'Help & Support'\n" +
    "- Select 'Contact Support'\n\n" +
    "**2. Choose a Contact Method**\n" +
    "- Email: parrotanalyzer@gmail.com\n" +
    "- Phone: +916363451047\n" +
    "- In-app chat support\n\n" +
    "**3. Submit a Ticket**\n" +
    "- Fill in your issue details\n" +
    "- Add screenshots if needed\n" +
    "- Tap 'Submit' to get assistance",

  "How do I know my assigned Group Admin?":
    "**1. Go to Profile**\n" +
    "- Open the app and navigate to 'Profile Details'\n" +
    "- Scroll to 'Admin Information'\n\n" +
    "**2. Check Admin Details**\n" +
    "- View assigned Group Admin name\n" +
    "- Find contact information\n" +
    "- See admin's department\n\n" +
    "**3. Contact Admin**\n" +
    "- Use provided contact details\n" +
    "- Reach out for any queries\n" +
    "- Request shift adjustments if needed",

  "How do I know if my expense report is approved?":
    "**1. Go to Expenses**\n" +
    "- Open the app and navigate to 'Expense History'\n" +
    "- Locate your submitted report\n\n" +
    "**2. Check Status**\n" +
    "- View current status (Pending/Approved/Rejected)\n" +
    "- Check admin comments if any\n" +
    "- See approval date if processed\n\n" +
    "**3. Contact Admin**\n" +
    "- If needed, reach out to your Group Admin\n" +
    "- Ask for status updates\n" +
    "- Clarify any concerns",

  "Why is my shift not being recorded?":
    "**1. Check Location Permissions**\n" +
    "- Ensure the app has location access enabled\n\n" +
    "**2. Ensure Internet Connectivity**\n" +
    "- A stable internet connection is required for tracking\n\n" +
    "**3. Restart the App**\n" +
    "- Close and reopen the app to refresh tracking\n\n" +
    "**4. Contact Support**\n" +
    "- If the issue persists, reach out via 'Help & Support'"
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
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-pro-exp-02-05' });

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

// Update findMatchingResponse to ensure complete responses
const findMatchingResponse = (userMessage: string): string | null => {
  const message = userMessage.toLowerCase().trim();
  
  // First check exact matches
  const exactMatch = CUSTOM_RESPONSES[message];
  if (exactMatch) {
    return exactMatch;
  }

  // Define common variations of questions
  const commonPhrases = {
    attendance: [
      'track time', 'record attendance', 'mark attendance', 'track hours',
      'attendance tracking', 'work hours', 'shift timing', 'start shift',
      'how to track', 'how do i track', 'how to mark', 'how do i mark',
      'track my attendance', 'mark my attendance', 'record my time'
    ],
    expense: ['how to submit', 'how do i submit', 'how to file', 'how to claim', 
             'how can i submit', 'expense submission', 'submit my expense'],
    leave: ['how to apply', 'how do i apply', 'how to request', 'how can i take', 
           'leave application', 'want to take leave'],
    admin: ['who is my', 'how to find', 'how do i know', 'how to contact', 
           'where to find', 'how can i see']
  };

  // Check for question variations
  if (commonPhrases.attendance.some(phrase => message.includes(phrase)) || 
      (message.includes('track') || message.includes('attendance') || message.includes('work hours'))) {
    return CUSTOM_RESPONSES["How do I track my work hours or how do i track my attendance?"];
  }

  if (commonPhrases.expense.some(phrase => message.includes(phrase)) && message.includes('expense')) {
    if (message.includes('travel')) {
      return CUSTOM_RESPONSES["How do I submit a travel expense?"];
    }
    return CUSTOM_RESPONSES["How do I submit an expense report?"];
  }

  // Enhanced question mappings with more variations
  const questionMappings: { [key: string]: string[] } = {
    "How do I track my work hours or how do i track my attendance?": [
      'track time', 'record attendance', 'mark attendance', 'track hours',
      'attendance tracking', 'work hours', 'shift timing', 'start shift',
      'end shift', 'clock in', 'clock out', 'record time', 'log hours',
      'attendance mark', 'shift record', 'working hours'
    ],
    "How do I submit an expense report?": [
      'submit expense', 'file expense', 'create expense', 'add expense',
      'expense report', 'claim expense', 'new expense', 'make expense',
      'expense submission', 'expense claim', 'expense form', 'report expense'
    ],
    "How do I submit a travel expense?": [
      'travel expense', 'travel claim', 'trip expense', 'journey expense',
      'travel cost', 'trip claim', 'travel bill', 'travel report',
      'journey claim', 'travel reimbursement'
    ],
    "How do I request leave?": [
      'apply leave', 'take leave', 'request vacation', 'apply vacation',
      'leave application', 'holiday request', 'time off', 'vacation time',
      'leave request', 'day off', 'leave form', 'vacation application'
    ],
    "How do I contact support?": [
      'contact help', 'reach support', 'help contact', 'support number',
      'support email', 'contact assistance', 'help desk', 'support team',
      'technical help', 'app support', 'get help'
    ],
    "How do I know my assigned Group Admin?": [
      'find admin', 'who admin', 'my supervisor', 'group admin',
      'admin contact', 'manager details', 'supervisor info',
      'admin information', 'who is my admin', 'admin details'
    ],
    "How do I know if my expense report is approved?": [
      'expense status', 'expense approved', 'check expense',
      'expense approval', 'expense claim status', 'report approved',
      'expense check', 'claim approved', 'expense verification'
    ],
    "Why is my shift not being recorded?": [
      'shift not recording', 'attendance problem', 'shift issue',
      'time not tracking', 'attendance not working', 'shift error',
      'tracking problem', 'attendance error', 'shift not working'
    ]
  };

  // Continue with existing keyword mappings
  for (const [question, keywords] of Object.entries(questionMappings)) {
    if (keywords.some(keyword => message.includes(keyword))) {
      return CUSTOM_RESPONSES[question];
    }
  }

  // If still no match, try similarity matching with a lower threshold
  const similarityThreshold = 0.4;
  for (const [question, response] of Object.entries(CUSTOM_RESPONSES)) {
    const similarity = calculateSimilarity(message, question);
    if (similarity >= similarityThreshold) {
      return response;
    }
  }

  // For app-related questions that didn't match exactly
  if (appKeywords.some(keyword => message.includes(keyword.toLowerCase()))) {
    // Find the most relevant response
    const bestMatch = Object.entries(CUSTOM_RESPONSES)
      .map(([q, r]) => ({ 
        question: q, 
        response: r, 
        similarity: calculateSimilarity(message, q)
      }))
      .sort((a, b) => b.similarity - a.similarity)[0];
    
    if (bestMatch && bestMatch.similarity > 0.3) {
      return bestMatch.response;
    }
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

    // Check if client supports streaming (based on headers)
    const acceptsEventStream = req.headers.accept?.includes('text/event-stream');

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

    // If no matching response found, use Gemini API
    const chat = model.startChat({
      history: [],
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();
    
    // Save the complete response to database
    await pool.query(
      `INSERT INTO chat_messages (user_id, message, response, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, message, response]
    );

    return res.json({ message: response });

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