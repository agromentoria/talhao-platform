// O Express 4 não captura rejeições de Promise automaticamente.
// Esse helper garante que qualquer erro dentro de uma rota async
// caia no middleware de erro central, em vez de travar o servidor.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
