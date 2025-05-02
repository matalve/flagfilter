export async function onRequestPost(context) {
    try {
        const { flagCode, flagName, issueType, issueDescription, userEmail } = await context.request.json();

        // Input validation
        if (!flagCode || !flagName || !issueType || !issueDescription) {
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Missing required fields' 
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Sanitize inputs
        const sanitizedMessage = `
🚩 New Flag Issue Report

Flag: ${flagName.replace(/[<>]/g, '')} (${flagCode.replace(/[<>]/g, '')})
Issue Type: ${issueType.replace(/[<>]/g, '')}
Description: ${issueDescription.replace(/[<>]/g, '')}
${userEmail ? `Contact Email: ${userEmail.replace(/[<>]/g, '')}` : ''}
        `.trim();

        // Send to Telegram
        const response = await fetch(`https://api.telegram.org/bot${context.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: context.env.TELEGRAM_CHAT_ID,
                text: sanitizedMessage,
                parse_mode: 'HTML'
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send Telegram message');
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error sending report:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'Failed to send report' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 