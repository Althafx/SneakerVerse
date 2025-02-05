const errorHandler = (err, req, res, next) => {
    // Log error details
    console.error('Error Details:');
    console.error('Name:', err.name);
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('Request URL:', req.originalUrl);
    console.error('Request Method:', req.method);
    console.error('Request Body:', req.body);
    console.error('User:', req.user ? req.user._id : 'Not logged in');

    // Set default status code and message
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Check if the request accepts JSON
    if (req.accepts('json')) {
        return res.status(statusCode).json({
            status: 'error',
            statusCode,
            message
        });
    }

    // Render error page for HTML requests
    res.status(statusCode).render('user/pageNotFound', {
        title: statusCode === 404 ? '404 Not Found' : 'Error',
        message: process.env.NODE_ENV === 'development' ? message : 'Something went wrong'
    });
};

module.exports = errorHandler;
