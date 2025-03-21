const Coupon = require('../../models/couponModel');

const couponController = {
    getCouponPage: async (req, res) => {
        try {
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const limit = 10;
            const skip = (page - 1) * limit;

            // Get total count for pagination
            const totalCoupons = await Coupon.countDocuments();
            
            // Get paginated coupons
            const coupons = await Coupon.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
            
            // Format coupon data for display
            const formattedCoupons = coupons.map(coupon => ({
                ...coupon.toObject(),
                usedCount: coupon.usedCount || 0,
                isExpired: new Date(coupon.expiryDate) < new Date(),
                isFullyUsed: (coupon.usedCount || 0) >= coupon.totalUses
            }));

            // Calculate pagination info
            const totalPages = Math.max(1, Math.ceil(totalCoupons / limit));
            
            // Ensure page is within valid range
            const currentPage = Math.min(page, totalPages);

            res.render('admin/couponManage', { 
                coupons: formattedCoupons,
                pagination: {
                    currentPage,
                    totalPages,
                    totalItems: totalCoupons
                }
            });
        } catch (error) {
            console.error('Error in getCouponPage:', error);
            res.status(500).send('Internal Server Error');
        }
    },

    addCoupon: async (req, res) => {
        try {
            const {
                code,
                offerAmount,
                minPurchase,
                startDate,
                expiryDate,
                totalUses,
                maxUsesPerUser
            } = req.body;

            const newCoupon = new Coupon({
                code: code.toUpperCase(),
                offerAmount,
                minPurchase,
                startDate,
                expiryDate,
                totalUses,
                maxUsesPerUser,
                isActive: true,
                usedCount: 0,
                userUsage: []
            });

            await newCoupon.save();
            res.status(201).json({ success: true, coupon: newCoupon });
        } catch (error) {
            console.error('Error in addCoupon:', error);
            res.status(400).json({ 
                success: false, 
                message: error.code === 11000 ? 'Coupon code already exists' : error.message 
            });
        }
    },

    toggleCouponStatus: async (req, res) => {
        try {
            const { couponId } = req.params;
            const coupon = await Coupon.findById(couponId);
            
            if (!coupon) {
                return res.status(404).json({ success: false, message: 'Coupon not found' });
            }

            coupon.isActive = !coupon.isActive;
            await coupon.save();

            res.json({ 
                success: true, 
                isActive: coupon.isActive,
                message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`
            });
        } catch (error) {
            console.error('Error in toggleCouponStatus:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    },

    deleteCoupon: async (req, res) => {
        try {
            const { couponId } = req.params;
            const result = await Coupon.findByIdAndDelete(couponId);
            
            if (!result) {
                return res.status(404).json({ success: false, message: 'Coupon not found' });
            }

            res.json({ success: true, message: 'Coupon deleted successfully' });
        } catch (error) {
            console.error('Error in deleteCoupon:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
};

module.exports = couponController;