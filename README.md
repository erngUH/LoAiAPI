## LoAi API

API for connecting [LoAi UI](https://github.com/erngUH/LoAi) to automatic1111 and manage users. 

Required configs: dbconfig, apiconfig

## Endpoints: 

/internal/register: register new user

/internal/verify: verify returning user

/internal/img2img: start img2img

/internal/progress: get current progress / server status

/internal/pastgens: get user past generations



## Database Schema:

![alt text](https://github.com/erngUH/sdapi/blob/master/scripts/db_schema.png)


## Database scripts: 

see /scripts:

register_user: insert new user

verify_user:   update existing user
