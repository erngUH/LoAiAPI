CREATE DEFINER=`admin`@`%` PROCEDURE `register_user`(IN uuidIn varchar(39),IN ipIn varchar(39))
BEGIN
	DECLARE ipcheck tinyint(1) default 0;
    
    SELECT count(ip) INTO ipcheck
    FROM userips where ip = ipIn; 
    IF ipcheck = 0 then 
		INSERT INTO userips (ip, ipstatus) values(ipIn, 1);
    end if; 
    
	INSERT INTO webusers(uuid, isactive, visitcount, lastvisit, created, ip)
    VALUES (uuidIn, 1, 1, CURDATE(), CURDATE(), ipIn);
	SELECT row_count() as result;
    INSERT INTO iplog (uuid, ip, logtime) values (uuidIn, ipIn, NOW());
END