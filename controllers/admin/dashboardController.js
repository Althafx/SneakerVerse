const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Order = require('../../models/orderSchema');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');
const fs = require('fs');
const path = require('path');

//--------------------------------------------------------------------------------------------------------------------------------------------------------

const getDashboardData = async (req, res) => {
    try {
        const range = req.query.range || 'monthly';

        // Get counts
        const totalUsers = await User.countDocuments({ isBlocked: false });
        const totalProducts = await Product.countDocuments({ isListed: true });
        const totalOrders = await Order.countDocuments();

        const orders = await Order.find({ status: 'Delivered' });
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

        // Get revenue and orders data based on selected range
        const chartData = await getChartData(range);

        // Get top 10 products
        const topProducts = await Order.aggregate([
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.product",
                    totalQuantity: { $sum: "$items.quantity" }
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" }
        ]);

        // Get top 10 categories with names
        const topCategories = await Product.aggregate([
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" },
            {
                $group: {
                    _id: "$category",
                    categoryName: { $first: "$categoryDetails.name" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Get top 10 brands
        const topBrands = await Product.aggregate([
            {
                $group: {
                    _id: "$brand",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Get recent orders
        const recentOrders = await Order.find()
            .populate('user', 'name')
            .populate('items.product', 'productName')
            .sort({ orderDate: -1 })
            .limit(5);

        res.render('admin/dashboard', {
            totalUsers,
            totalProducts,
            totalOrders,
            totalRevenue,
            chartData,
            topProducts,
            topCategories,
            topBrands,
            recentOrders,
            selectedRange: range
        });
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).send('Internal Server Error');
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

// API endpoint for chart data
const getChartDataAPI = async (req, res) => {
    try {
        const range = req.query.range || 'monthly';
        const data = await getChartData(range);
        res.json(data);
    } catch (error) {
        console.error('Chart Data Error:', error);
        res.status(500).json({ error: 'Failed to fetch chart data' });
    }
};

//--------------------------------------------------------------------------------------------------------------------------------------------------------

async function getChartData(range = 'monthly') {
    try {
        const currentDate = new Date();
        let startDate = new Date();
        let labels = [];
        let format = {};

        // Set date range and format based on selection
        switch(range) {
            case 'weekly':
                startDate.setDate(currentDate.getDate() - 6); // Last 7 days including today
                startDate.setHours(0, 0, 0, 0);
                format = { weekday: 'short', month: 'short', day: 'numeric' };
                break;
            case 'yearly':
                startDate.setFullYear(currentDate.getFullYear() - 1);
                format = { month: 'short' };
                break;
            case 'monthly':
            default:
                startDate.setMonth(currentDate.getMonth() - 5); // Last 6 months including current
                format = { month: 'short' };
                break;
        }

        // Get all orders within the date range
        const orders = await Order.find({
            orderDate: {
                $gte: startDate,
                $lte: currentDate
            }
        }).sort({ orderDate: 1 });

        let revenueData = {};
        let orderData = {};

        // Initialize data structure based on range
        if (range === 'weekly') {
            for (let i = 0; i < 7; i++) {
                let date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                let label = date.toLocaleDateString('en-US', format);
                labels.push(label);
                revenueData[label] = 0;
                orderData[label] = 0;
            }
        } else if (range === 'yearly') {
            for (let i = 0; i < 12; i++) {
                let date = new Date(currentDate);
                date.setMonth(currentDate.getMonth() - (11 - i));
                let label = date.toLocaleDateString('en-US', format);
                labels.push(label);
                revenueData[label] = 0;
                orderData[label] = 0;
            }
        } else {
            // Monthly (6 months)
            for (let i = 0; i < 6; i++) {
                let date = new Date(currentDate);
                date.setMonth(currentDate.getMonth() - (5 - i));
                let label = date.toLocaleDateString('en-US', format);
                labels.push(label);
                revenueData[label] = 0;
                orderData[label] = 0;
            }
        }

        // Aggregate orders data
        orders.forEach(order => {
            const date = new Date(order.orderDate);
            const label = date.toLocaleDateString('en-US', format);
            
            if (revenueData[label] !== undefined) {
                if (order.status === 'Delivered') {
                    revenueData[label] += order.totalAmount;
                }
                orderData[label] += 1;
            }
        });

        return {
            labels: labels,
            revenue: labels.map(label => revenueData[label]),
            orders: labels.map(label => orderData[label])
        };
    } catch (error) {
        console.error('Error getting chart data:', error);
        throw error;
    }
}

//--------------------------------------------------------------------------------------------------------------------------------------------------------

const generateSalesReport = async (req, res) => {
    try {
        const { dateRange, format } = req.body;
        let startDate, endDate;
        const currentDate = new Date();

        // Set date range based on report type
        switch (dateRange) {
            case 'daily':
                startDate = new Date(currentDate.setHours(0, 0, 0, 0));
                endDate = new Date(currentDate.setHours(23, 59, 59, 999));
                break;
            case 'weekly':
                startDate = new Date();
                startDate.setDate(currentDate.getDate() - 7);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'yearly':
                startDate = new Date();
                startDate.setFullYear(currentDate.getFullYear() - 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                break;
            case 'custom':
                if (!req.body.startDate || !req.body.endDate) {
                    return res.status(400).json({ error: 'Start and end dates are required for custom range' });
                }
                startDate = new Date(req.body.startDate);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(req.body.endDate);
                endDate.setHours(23, 59, 59, 999);
                break;
            default:
                return res.status(400).json({ error: 'Invalid date range' });
        }

        // Get orders within date range
        const orders = await Order.find({
            orderDate: { $gte: startDate, $lte: endDate }
        })
        .populate({
            path: 'user',
            select: 'name',
            options: { allowEmptyResult: true }
        })
        .populate('items.product', 'productName price')
        .sort({ orderDate: -1 });

        if (orders.length === 0) {
            return res.status(404).json({ error: 'No orders found for the selected date range' });
        }

        // Calculate summary
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

        // Create reports directory if it doesn't exist
        const reportsDir = path.join(__dirname, '../../public/reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        // Generate report based on format
        if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');

            // Add title and styling
            worksheet.mergeCells('A1:E1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'SneakerVerse Sales Report';
            titleCell.font = { size: 16, bold: true };
            titleCell.alignment = { horizontal: 'center' };

            // Add report info
            worksheet.mergeCells('A2:E2');
            const reportTypeCell = worksheet.getCell('A2');
            reportTypeCell.value = `Report Type: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)} | Generated Date: ${new Date().toLocaleDateString()}`;
            reportTypeCell.alignment = { horizontal: 'center' };

            // Add date range
            worksheet.mergeCells('A3:E3');
            const dateRangeCell = worksheet.getCell('A3');
            dateRangeCell.value = `Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
            dateRangeCell.alignment = { horizontal: 'center' };

            // Add summary
            worksheet.mergeCells('A4:E4');
            const summaryCell = worksheet.getCell('A4');
            summaryCell.value = `Summary: Total Orders: ${totalOrders} | Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')}`;
            summaryCell.alignment = { horizontal: 'center' };

            // Add headers
            worksheet.addRow(['Order ID', 'Date', 'Customer', 'Status', 'Amount']);
            const headerRow = worksheet.getRow(5);
            headerRow.font = { bold: true };
            headerRow.alignment = { horizontal: 'center' };

            // Add order data
            orders.forEach(order => {
                worksheet.addRow([
                    order._id.toString(),
                    new Date(order.orderDate).toLocaleDateString(),
                    order.user ? order.user.name : 'Deleted User',
                    order.status,
                    `₹${order.totalAmount.toLocaleString('en-IN')}`
                ]).alignment = { horizontal: 'center' };
            });

            // Style the worksheet
            worksheet.columns.forEach(column => {
                column.width = 20;
            });

            // Generate file
            const fileName = `sales_report_${Date.now()}.xlsx`;
            const filePath = path.join(reportsDir, fileName);
            await workbook.xlsx.writeFile(filePath);
            
            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Download error:', err);
                    return res.status(500).json({ error: 'Error downloading file' });
                }
                // Delete file after download
                fs.unlinkSync(filePath);
            });

        } else if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            const fileName = `sales_report_${Date.now()}.pdf`;
            const filePath = path.join(reportsDir, fileName);
            
            // Pipe the PDF to a file
            doc.pipe(fs.createWriteStream(filePath));

            // Add title
            doc.fontSize(20).text('SneakerVerse Sales Report', { align: 'center' });
            doc.moveDown();

            // Add report info
            doc.fontSize(12)
               .text(`Report Type: ${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}`, { align: 'center' })
               .text(`Generated Date: ${new Date().toLocaleDateString()}`, { align: 'center' })
               .text(`Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, { align: 'center' });
            doc.moveDown();

            // Add summary
            doc.text('Summary:', { align: 'center' })
               .text(`Total Orders: ${totalOrders}`, { align: 'center' })
               .text(`Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')}`, { align: 'center' });
            doc.moveDown();

            // Add order details table
            const table = {
                headers: ['Order ID', 'Date', 'Customer', 'Status', 'Amount'],
                rows: orders.map(order => [
                    order._id.toString(),
                    new Date(order.orderDate).toLocaleDateString(),
                    order.user ? order.user.name : 'Deleted User',
                    order.status,
                    `₹${order.totalAmount.toLocaleString('en-IN')}`
                ])
            };

            await doc.table(table, {
                prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
                prepareRow: () => doc.font('Helvetica').fontSize(10)
            });

            // Finalize the PDF
            doc.end();

            // Wait for the file to be written
            setTimeout(() => {
                res.download(filePath, fileName, (err) => {
                    if (err) {
                        console.error('Download error:', err);
                        return res.status(500).json({ error: 'Error downloading file' });
                    }
                    // Delete file after download
                    fs.unlinkSync(filePath);
                });
            }, 1000);
        }

    } catch (error) {
        console.error('Report Generation Error:', error);
        res.status(500).json({ error: 'Error generating report: ' + error.message });
    }
};

module.exports = {
    getDashboardData,
    getChartDataAPI,
    generateSalesReport
};
