CREATE DEFINER=`admin`@`%` PROCEDURE `verify_user`(IN uuidIn varchar(39),IN ipIn varchar(39), IN addvisit TINYINT(1))
BEGIN
DECLARE currentIP varchar(39);
DECLARE userresult tinyint(1) DEFAULT 0;
DECLARE ipresult tinyint(1) DEFAULT 0;
DECLARE currentStatus tinyint(1) DEFAULT 1;
DECLARE currentIPStatus tinyint(1) DEFAULT 1;
DECLARE result tinyint(1) DEFAULT 1;
SELECT
    w.isactive, i.ipstatus, w.ip, count(*)
INTO currentStatus , currentIPStatus , currentIP, userresult FROM
    webusers w
        LEFT JOIN
    userips i ON w.ip = i.ip
WHERE
    w.uuid = uuidIn AND w.isactive = 1
        AND i.ipstatus
ORDER BY w.created DESC
LIMIT 1;

if addvisit = 1 then
	update webusers set visitcount = visitcount + 1 where uuid = uuidIn;
end if;

IF currentStatus = 0 or currentIPStatus = 0 or userresult = 0 then 
	select 0 into result;
end if;

IF ipIn IS NOT NULL AND (currentIP <> ipIn OR currentIP IS NULL)THEN
	SELECT count(*) INTO ipresult FROM userips WHERE ip = ipIn;
    IF ipresult = 0 THEN
		INSERT INTO userips (ip, ipstatus) VALUES (ipIn, 1);
    END IF;
	UPDATE webusers 
	SET 
		ip = ipIn
	WHERE
    uuid = uuidIn;
    INSERT INTO iplog (uuid, ip, logtime) values (uuidIn, ipIn, NOW());
END IF;

SELECT result; 
END