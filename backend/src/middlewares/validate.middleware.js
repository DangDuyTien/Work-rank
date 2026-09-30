function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      const flattened = result.error.flatten();
      const firstFieldErr = Object.values(flattened.fieldErrors || {})[0]?.[0];
      const message = firstFieldErr || 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại.';
      return res.status(400).json({ message, error: message, errors: flattened });
    }
    req.validated = result.data;
    return next();
  };
}

module.exports = validate;
