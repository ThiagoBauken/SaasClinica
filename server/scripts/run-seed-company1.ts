import { seedCompleteData } from './seed-complete-data';

seedCompleteData(1)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erro:", err);
    process.exit(1);
  });
