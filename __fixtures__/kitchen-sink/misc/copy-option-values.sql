-- COPY option values keep their meaning
COPY t FROM STDIN (HEADER false);
COPY t FROM STDIN (HEADER true, FREEZE false);
COPY t FROM STDIN (FORMAT "CSV");
COPY t FROM STDIN (FORMAT 'csv', HEADER off);
