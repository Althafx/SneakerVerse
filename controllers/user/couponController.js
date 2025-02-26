const Coupon = require('../../models/couponModel');

const userCouponController = {
    // Validate and apply coupon
    validateCoupon: async (req, res) => {
        try {
            const { code, userId, totalAmount } = req.body;

            const coupon = await Coupon.findOne({ 
                code: code.toUpperCase(),
                isActive: true,
                startDate: { $lte: new Date() },
                expiryDate: { $gt: new Date() }
            });

            if (!coupon) {
                return res.status(404).json({ message: 'Invalid or expired coupon' });
            }

            // Check minimum purchase amount
            if (parseFloat(totalAmount) < coupon.minPurchase) {
                return res.status(400).json({ 
                    message: `Minimum purchase amount of ₹${coupon.minPurchase} required`
                });
            }

            // Check if coupon has reached total usage limit
            if (coupon.usedCount >= coupon.totalUses) {
                return res.status(400).json({ message: 'Coupon usage limit reached' });
            }

            // Check user's usage limit
            const userUsage = coupon.userUsage.find(u => u && u.userId && u.userId.toString() === userId);
            if (userUsage && userUsage.usageCount >= coupon.maxUsesPerUser) {
                return res.status(400).json({ 
                    message: `You've reached the maximum usage limit for this coupon`
                });
            }

            res.status(200).json({
                message: 'Coupon applied successfully',
                discount: coupon.offerAmount
            });
        } catch (error) {
            console.error('Error in validateCoupon:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Get applicable coupons
    getApplicableCoupons: async (req, res) => {
        try {
            const userId = req.session.user._id;
            const { totalAmount } = req.query;
            

            const coupons = await Coupon.find({
                isActive: true,
                startDate: { $lte: new Date() },
                expiryDate: { $gt: new Date() },
                minPurchase: { $lte: parseFloat(totalAmount) }
            });

          

            // Filter out coupons where user has reached their usage limit
            const applicableCoupons = coupons.filter(coupon => {
                if (!coupon.userUsage) return true;
                const userUsage = coupon.userUsage.find(u => u && u.userId && u.userId.toString() === userId.toString());
                return !userUsage || userUsage.usageCount < coupon.maxUsesPerUser;
            });

          
            res.status(200).json({ coupons: applicableCoupons });
        } catch (error) {
            console.error('Error in getApplicableCoupons:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Apply coupon
    applyCoupon: async (req, res) => {
        try {
            const { code, totalAmount } = req.body;
            const userId = req.session.user._id;
            
            const coupon = await Coupon.findOne({ 
                code: code.toUpperCase(),
                isActive: true,
                startDate: { $lte: new Date() },
                expiryDate: { $gt: new Date() }
            });

          

            if (!coupon) {
                return res.status(404).json({ message: 'Invalid or expired coupon' });
            }

            // Check minimum purchase amount
            if (parseFloat(totalAmount) < coupon.minPurchase) {
                return res.status(400).json({ 
                    message: `Minimum purchase amount of ₹${coupon.minPurchase} required`
                });
            }

            // Check if coupon has reached total usage limit
            if (coupon.usedCount >= coupon.totalUses) {
                return res.status(400).json({ message: 'Coupon usage limit reached' });
            }

            // Check user's usage limit
            if (!coupon.userUsage) coupon.userUsage = [];
            const userUsage = coupon.userUsage.find(u => u && u.userId && u.userId.toString() === userId.toString());
            if (userUsage && userUsage.usageCount >= coupon.maxUsesPerUser) {
                return res.status(400).json({ 
                    message: `You've reached the maximum usage limit for this coupon`
                });
            }

            // Store coupon in session
            if (!req.session) req.session = {};
            req.session.appliedCoupon = {
                code: coupon.code,
                discount: coupon.offerAmount
            };

            res.status(200).json({
                message: 'Coupon applied successfully',
                discount: coupon.offerAmount
            });
        } catch (error) {
            console.error('Error in applyCoupon:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Remove coupon
    removeCoupon: async (req, res) => {
        try {
            if (req.session && req.session.appliedCoupon) {
                delete req.session.appliedCoupon;
            }
            res.status(200).json({ message: 'Coupon removed successfully' });
        } catch (error) {
            console.error('Error in removeCoupon:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Apply coupon to order (internal use)
    applyCouponToOrder: async (orderId, userId, couponCode) => {
        try {
            const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
            if (!coupon) return;

            // Initialize userUsage array if it doesn't exist
            if (!coupon.userUsage) coupon.userUsage = [];

            // Update coupon usage
            const userUsageIndex = coupon.userUsage.findIndex(u => u && u.userId && u.userId.toString() === userId.toString());
            if (userUsageIndex === -1) {
                coupon.userUsage.push({ userId, usageCount: 1 });
            } else {
                coupon.userUsage[userUsageIndex].usageCount += 1;
            }
            coupon.usedCount = (coupon.usedCount || 0) + 1;
            await coupon.save();
        } catch (error) {
            console.error('Error applying coupon to order:', error);
        }
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

module.exports = userCouponController;
