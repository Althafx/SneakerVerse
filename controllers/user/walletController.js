const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

//--------------------------------------------------------------------------------------------------------------------------------------------------------

const walletController = {
    // Get wallet page with balance and transactions
    getWalletPage: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect("/login");
            }

            const userId = req.session.user;
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = 10;
            
            // Get user and wallet data
            const user = await User.findById(userId);
            let wallet = await Wallet.findOne({ userId });
            
            if (!wallet) {
                wallet = await new Wallet({ userId }).save();
            }

            // Convert wallet to object and sort transactions by timestamp
            const walletObj = wallet.toObject();
            walletObj.transactions = walletObj.transactions.sort((a, b) => {
                const dateA = a.timestamp || a.date || new Date(0);
                const dateB = b.timestamp || b.date || new Date(0);
                return new Date(dateB) - new Date(dateA);
            });

            // Get total number of transactions
            const totalTransactions = walletObj.transactions.length;
            const totalPages = Math.max(1, Math.ceil(totalTransactions / limit));
            
            // Ensure page is within valid range
            const currentPage = Math.min(page, totalPages);
            
            // Get paginated transactions
            const startIndex = (currentPage - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedTransactions = walletObj.transactions.slice(startIndex, endIndex);

            // Create wallet object with paginated transactions
            const walletWithPaginatedTransactions = {
                ...walletObj,
                transactions: paginatedTransactions
            };

            res.render('user/wallet', {
                wallet: walletWithPaginatedTransactions,
                user,
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                path: '/wallet',
                pagination: {
                    currentPage,
                    totalPages,
                    totalItems: totalTransactions
                }
            });
        } catch (error) {
            console.error('Error in getWalletPage:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Create Razorpay order for adding money
    createOrder: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect("/login");
            }

            const { amount } = req.body;
            const options = {
                amount: amount * 100, // Razorpay amount in paise
                currency: 'INR',
                receipt: 'wallet_' + Date.now()
            };

            const order = await razorpay.orders.create(options);
            res.json(order);
        } catch (error) {
            console.error('Error in createOrder:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Verify payment and add money to wallet
    verifyPayment: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect("/login");
            }

            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
            const userId = req.session.user;

            // Verify signature
            const sign = razorpay_order_id + '|' + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(sign)
                .digest('hex');

            if (razorpay_signature !== expectedSign) {
                return res.status(400).json({ error: 'Invalid signature' });
            }

            // Get payment details
            const payment = await razorpay.payments.fetch(razorpay_payment_id);
            const amount = payment.amount / 100; // Convert paise to rupees

            // Update wallet
            const wallet = await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: amount },
                    $push: {
                        transactions: {
                            type: 'credit',
                            amount,
                            description: 'Added money via Razorpay',
                            status: 'completed',
                            paymentId: razorpay_payment_id
                        }
                    }
                },
                { new: true }
            );

            res.json({ success: true, wallet });
        } catch (error) {
            console.error('Error in verifyPayment:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Get transaction history
    getTransactions: async (req, res) => {
        try {
            if (!req.session.user) {
                return res.redirect("/login");
            }

            const userId = req.session.user;
            const wallet = await Wallet.findOne({ userId });
            
            if (!wallet) {
                return res.status(404).json({ error: 'Wallet not found' });
            }

            res.json(wallet.transactions);
        } catch (error) {
            console.error('Error in getTransactions:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = walletController;