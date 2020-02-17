#!/bin/vbash
#Program: 获取路由器IP
#AUTHOR: jiangyao
#Date: 20200216
run=/opt/vyatta/bin/vyatta-op-cmd-wrapper
unicom=`$run show interfaces pppoe pppoe0 | awk 'NR==3{print $2}'`
telecom=`$run show interfaces pppoe pppoe1 | awk 'NR==3{print $2}'`
echo "${unicom} ${telecom}"