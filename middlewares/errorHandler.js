const errorHandler = (err, req, res, next) => {
	// Set default status code and message
	const statusCode = err.statusCode || 500;
	const message = err.message || 'Internal Server Error';

	// Log error for debugging
	console.error('Error:', err);

	// Render pageNotFound for all errors
	res.status(statusCode).render('user/pageNotFound', {
		title: statusCode === 404 ? '404 Not Found' : 'Error',
		message: message
	});
};

module.exports = errorHandler;
