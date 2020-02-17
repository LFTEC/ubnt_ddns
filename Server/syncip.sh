#!/bin/bash
#Program: 获取路由器IP,并将IP发布到dnspod
#Author: jiangyao
#Date: 20190809
echo -e "[$(date '+%F %T')] 开始进行外网IP同步工作.."
echo -e "[$(date '+%F %T')] 获取路由器外网IP地址.."
ipstring=`ssh admin@192.168.1.1 -p 2222 /home/admin/get_ip.sh`
if [ $? -ne 0 ]; then
    exit 1
fi
uni=`echo ${ipstring} | awk '{print $1}'`
tele=`echo ${ipstring} | awk '{print $2}'`
echo -e "[$(date '+%F %T')] 当前联通外网IP地址为: ${uni}"
echo -e "[$(date '+%F %T')] 当前电信外网IP地址为: ${tele}"
/usr/local/bin/node ./uploadDNS/main.js ${ipstring}
