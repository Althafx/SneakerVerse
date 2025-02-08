const Coupon = require('../../models/couponModel');

const couponController = {
    getCouponPage: async (req, res) => {
        try {
            const coupons = await Coupon.find();
            res.render('admin/couponManage', { coupons });
        } catch (error) {
            console.error(error);
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
                isActive: true
            });

            await newCoupon.save();
            res.status(201).json({ success: true, coupon: newCoupon });
        } catch (error) {
            console.error(error);
            res.status(400).json({ success: false, message: error.message });
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

            res.json({ success: true, isActive: coupon.isActive });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    },

    deleteCoupon: async (req, res) => {
        try {
            const { couponId } = req.params;
            await Coupon.findByIdAndDelete(couponId);
            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
};

module.exports = couponController;