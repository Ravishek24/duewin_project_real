## 全局公共参数
#### 全局Header参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### 全局Query参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### 全局Body参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### 全局认证方式
```text
noauth
```
#### 全局预执行脚本
```javascript
暂无预执行脚本
```
#### 全局后执行脚本
```javascript
暂无后执行脚本
```
## /签名说明
```text
## 测试KEY
accessKey:  tw58ui0z60yYhaCTyROy6g

accessSecret: IwoScoHCG0C6cUf3N5qDJg





# 签名说明

### OpenAPI 签名流程
客户端在请求时，需要按照如下步骤生成签名 Signature，并添加公共参数：

公共请求参数

在原始请求的基础上添加 Header 请求参数


`accessKey`：身份标识

`timestamp`：时间戳，精确到秒

`nonce`：唯一随机数，建议为一个6位的随机数

`sign`：签名数据（见“计算签名”部分）

#### 计算签名
按照如下顺序对请求中的参数进行排序，各个参数通过&进行拼接（中间不含空格）：

`method & url & accessKey & timestamp & nonce`

`method` 需要大写，如：GET

`url` 去除协议、域名、参数，以 / 开头，如：/api/demo/helloWord

使用 HMAC-SHA256 协议创建基于哈希的消息身份验证代码 (HMAC)，以 `appSecret` 作为密钥，对上面拼接的参数进行计算签名，所得签名进行 Base-64 编码

HMAC-SHA256 在线计算：

https://1024tools.com/hmac




#### 例子

如: 查询商户余额

拼接结果`GET&/api/merchant/Balance&tw58ui0z60yYhaCTyROy6g&1721916124&634216`

accessSecret: `IwoScoHCG0C6cUf3N5qDJg`

可以查看商户余额查询接口,进行在线调整

![image.png](https://img.cdn.apipost.cn/client/user/1324143/avatar/78805a221a988e79ef3f42d7c5bfd41866a25b5221c7f.png "image.png")
```
## /商户
```text
暂无描述
```
#### Header参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### Query参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### Body参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
## /商户/查询余额
```text
<details>
  <summary>点击查看示例代码！</summary>
 ** C# 示例代码**


using System.Security.Cryptography;
using System.Text;

namespace ApiTest;

internal class Program
{
    private static async Task Main(string[] args)
    {
        // 测试参数
        var apiHost = "https://api.example.com";
        var accessKey = "yourAccessKey";
        var accessSecret = "yourAccessSecret";

        // 测试查询余额
        Console.WriteLine("\n开始测试 QueryBalance 方法...");
        var balanceResult = await QueryBalanceAsync(apiHost, accessKey, accessSecret);
        Console.WriteLine($"查询余额结果: {balanceResult}");

        Console.WriteLine("\n测试完成。按任意键退出...");
        Console.ReadKey();
    }

    public static async Task<string> QueryBalanceAsync(string apiHost, string accessKey, string accessSecret)
    {
        // 处理API主机地址并构建URL
        apiHost = apiHost.TrimEnd('/');
        var url = $"{apiHost}/api/merchant/Balance";

        // 准备签名相关数据
        var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();
        var nonce = GenerateNonce(6); // 文档中提到使用6位随机字符串
        var signature = GenerateSignature("GET", url, timestamp, nonce, accessKey, accessSecret);

        try
        {
            using var client = new HttpClient();

            // 添加请求头
            client.DefaultRequestHeaders.Add("accessKey", accessKey);
            client.DefaultRequestHeaders.Add("timestamp", timestamp.ToString());
            client.DefaultRequestHeaders.Add("nonce", nonce);
            client.DefaultRequestHeaders.Add("sign", signature);

            // 发送GET请求
            var response = await client.GetAsync(url);

            // 处理响应
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"请求失败: {response.StatusCode}");
                return string.Empty;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"查询余额异常: {ex.Message}");
            return string.Empty;
        }
    }

    // 生成随机字符串作为nonce
    private static string GenerateNonce(int len = 8)
    {
        const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return string.Concat(Enumerable.Range(0, len).Select(_ => chars[Random.Shared.Next(chars.Length)]));
    }

    // 获取URL路径部分
    private static string FormatUrl(string url) => new Uri(url).AbsolutePath;

    // 生成API签名
    private static string GenerateSignature(string method, string url, long timestamp, string nonce, string accessKey, string accessSecret)
    {
        var formattedUrl = FormatUrl(url);
        var signatureData = $"{method.ToUpper()}&{formattedUrl}&{accessKey}&{timestamp}&{nonce}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
    }
}
</details>
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/merchant/Balance

#### 请求方式
> GET

#### Content-Type
> none

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | tw58ui0z60yYhaCTyROy6g | String | 是 | 用户 accessKey
timestamp | 1721916124 | String | 是 | 10位时间戳
nonce | 634216 | String | 是 | 6位随机字符串
sign | 4RYaNXUjiLS473r4yGizHTqRcy1rtTdETPSH9Gdhpf8= | String | 是 | 签名结果 accessKey 在线工具 https://1024tools.com/hmac
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 200,
	"type": "success",
	"message": "",
	"result": [
		{
			"currency": "inr",
			"balance": 100000
		}
	],
	"time": "2024-07-25 19:29:35"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 200 | Integer | 操作状态 非200 失败
type | success | String | API操作状态
message | - | String | 操作消息
result | - | Array | 资产列表
result.currency | inr | String | 货币名称
result.balance | 100000 | Integer | 余额
time | 2024-07-25 19:29:35 | String | 消息时间
## /代收
```text
暂无描述
```
#### Header参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### Query参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### Body参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
## /代收/创建代收订单
```text
<details>
  <summary>点击查看示例代码！</summary>
 ** C# 示例代码**


using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ApiTest;

internal class Program
{
    private static async Task Main(string[] args)
    {
        // 测试参数
        var apiHost = "https://api.example.com";
        var accessKey = "yourAccessKey";
        var accessSecret = "yourAccessSecret";

        // 测试创建订单
        Console.WriteLine("\n开始测试 CreateOrder 方法...");
        var orderRequest = new OrderRequest
        {
            McorderNo = $"MC{DateTimeOffset.Now.ToUnixTimeMilliseconds()}",
            Amount = "1000.00",
            Type = "inr",
            ChannelCode = "71001",
            CallBackUrl = "http://127.0.0.1/api/notify/transaction",
            JumpUrl = "http://127.0.0.1/api/notify/transaction"
        };
        var createOrderResult = await CreateOrderAsync(apiHost, accessKey, accessSecret, orderRequest);
        Console.WriteLine($"创建订单结果: {createOrderResult}");

        Console.WriteLine("\n测试完成。按任意键退出...");
        Console.ReadKey();
    }

    public static async Task<string> CreateOrderAsync(string apiHost, string accessKey, string accessSecret, OrderRequest orderRequest)
    {
        // 处理API主机地址并构建URL
        apiHost = apiHost.TrimEnd('/');
        var url = $"{apiHost}/api/order/create";

        // 准备签名相关数据
        var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();
        var nonce = GenerateNonce(6); // 文档要求6位随机字符串
        var signature = GenerateSignature("POST", url, timestamp, nonce, accessKey, accessSecret);

        try
        {
            using var client = new HttpClient();

            // 添加请求头
            client.DefaultRequestHeaders.Add("accessKey", accessKey);
            client.DefaultRequestHeaders.Add("timestamp", timestamp.ToString());
            client.DefaultRequestHeaders.Add("nonce", nonce);
            client.DefaultRequestHeaders.Add("sign", signature);

            // 准备请求体并发送请求
            var content = new StringContent(
                JsonSerializer.Serialize(orderRequest),
                Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(url, content);

            // 处理响应
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"请求失败: {response.StatusCode}");
                return string.Empty;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"创建订单异常: {ex.Message}");
            return string.Empty;
        }
    }

    // 生成随机字符串作为nonce
    private static string GenerateNonce(int len = 8)
    {
        const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return string.Concat(Enumerable.Range(0, len).Select(_ => chars[Random.Shared.Next(chars.Length)]));
    }

    // 获取URL路径部分
    private static string FormatUrl(string url) => new Uri(url).AbsolutePath;

    // 生成API签名
    private static string GenerateSignature(string method, string url, long timestamp, string nonce, string accessKey, string accessSecret)
    {
        var formattedUrl = FormatUrl(url);
        var signatureData = $"{method.ToUpper()}&{formattedUrl}&{accessKey}&{timestamp}&{nonce}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
    }
}


public class OrderRequest
{
    public string McorderNo { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ChannelCode { get; set; } = string.Empty;
    public string CallBackUrl { get; set; } = string.Empty;
    public string JumpUrl { get; set; } = string.Empty;
}
</details>







## 货币类型

type: ['inr' , 'trx', 'usdt']

inr: 卢比

trx: 波场TRX

usdt:  波场USDT


## 状态枚举
status

    created : 创建,    商户拉单成功后的状态

    paying :  支付中,   真实用户访问收银台后的状态
    
    timeOut : 超时,      订单超时

    success : 成功,       用户支付成功

    fail : 失败,         用户支付失败

    cancel : 取消,       用户取消支付

    exception : 异常,     订单异常
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/order/create

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | tw58ui0z60yYhaCTyROy6g | String | 是 | 用户 accessKey
timestamp | 1721123166 | String | 是 | 10位时间戳
nonce | 627787 | String | 是 | 6位随机字符串
sign | Pq7mRypykcwsrpU8RGhBO5AWqiRz+sLFnI/bf8ucwkM= | String | 是 | 签名结果 accessKey 在线工具 https://1024tools.com/hmac
#### 请求Body参数
```javascript
{
    "McorderNo": "41453135443316534011",
    "Amount": "1000",
    "Type": "inr",
    "ChannelCode": "71001",
    "CallBackUrl": "http://127.0.0.1:5005/api/notify/transaction",
    "JumpUrl": "http://127.0.0.1:5005/api/notify/transaction"
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
McorderNo | 41874553643314011011 | String | 是 | 商户订单号, 不允许重复
Amount | 1000 | String | 是 | 代收金额,最多支持两位小数, 两位之外自动截断
Type | inr | String | 是 | 货币类型,(查看说明)
ChannelCode | 71001 | String | 是 | 您绑定的通道代码
CallBackUrl | http://127.0.0.1:5005/api/notify/transaction | String | 是 | 订单消息回调地址
JumpUrl | http://127.0.0.1:5005/api/notify/transaction | String | 是 | 支持完成后收银台跳转地址( 一般指向商家订单的用户访问地址)
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 200,
	"type": "success",
	"message": "",
	"result": {
		"orderNo": "20240525203241417010001",
		"merchantOrder": "418745536433411011",
		"amount": 1000,
		"status": "created",
		"type": "inr",
		"fee": 65,
		"payUrl": "https://pay.tkusdtmanage.com/20240525203241417010001",
		"expireTime": 0
	},
	"time": "2024-05-25 20:32:43"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 200 | Integer | 操作状态 非200 失败
type | success | String | API操作状态
message | - | String | 操作消息
result | - | Object | -
result.orderNo | 20240525203241417010001 | String | 平台订单号
result.merchantOrder | 418745536433411011 | String | 商家订单号
result.amount | 1000 | Integer | 金额,
result.status | created | String | 订单状态(查询状态说明), 访问收银台订单状态会改变为 paying ,订单超时,成功或失败时会有回调, CallBackUrl参数决定
result.type | inr | String | 货币类型
result.fee | 65 | Integer | 代收费用
result.payUrl | https://pay.tkusdtmanage.com/20240525203241417010001 | String | 收银台地址
result.expireTime | 0 | Integer | 超时时间
time | 2024-05-25 20:32:43 | String | 消息时间
## /代收/创建代收订单-同步(四方使用)
```text
# 当前接口 非四方系统请不要使用



## 货币类型

type: ['inr' , 'trx', 'usdt']

inr: 卢比

trx: 波场TRX

usdt:  波场USDT


## 状态枚举
status

    created : 创建,    商户拉单成功后的状态

    paying :  支付中,   真实用户访问收银台后的状态
    
    timeOut : 超时,      订单超时

    success : 成功,       用户支付成功

    fail : 失败,         用户支付失败

    cancel : 取消,       用户取消支付

    exception : 异常,     订单异常
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/order/createwait

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | uDiE8fdCEUiavDM1zWm4tQ | String | 是 | 用户 accessKey
timestamp | 1750776745 | String | 是 | 10位时间戳
nonce | 814897 | String | 是 | 6位随机字符串
sign | dbXr/x7EZ+1V0nj6fxrbJc+VAOPWcdWcCqEasWN5V8U= | String | 是 | 签名结果 accessKey 在线工具 https://1024tools.com/hmac
#### 请求Body参数
```javascript
{
    "McorderNo": "41874531164316222011",
    "Amount": "5000",
    "Type": "inr",
    "ChannelCode": "71211",
    "CallBackUrl": "http://127.0.0.1:5005/api/notify/transaction",
    "JumpUrl": "http://127.0.0.1:5005/api/notify/transaction"
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
McorderNo | 41874553643314011011 | String | 是 | 商户订单号, 不允许重复
Amount | 1000 | String | 是 | 代收金额,最多支持两位小数, 两位之外自动截断
Type | inr | String | 是 | 货币类型,(查看说明)
ChannelCode | 71001 | String | 是 | 您绑定的通道代码
CallBackUrl | http://127.0.0.1:5005/api/notify/transaction | String | 是 | 订单消息回调地址
JumpUrl | http://127.0.0.1:5005/api/notify/transaction | String | 是 | 支持完成后收银台跳转地址( 一般指向商家订单的用户访问地址)
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 200,
	"type": "success",
	"message": "",
	"result": {
		"orderNo": "20240525203241417010001",
		"merchantOrder": "418745536433411011",
		"amount": 1000,
		"status": "created",
		"type": "inr",
		"fee": 65,
		"payUrl": "https://pay.tkusdtmanage.com/20240525203241417010001",
		"expireTime": 0
	},
	"time": "2024-05-25 20:32:43"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 200 | Integer | 操作状态 非200 失败
type | success | String | API操作状态
message | - | String | 操作消息
result | - | Object | -
result.orderNo | 20240525203241417010001 | String | 平台订单号
result.merchantOrder | 418745536433411011 | String | 商家订单号
result.amount | 1000 | Integer | 金额,
result.status | created | String | 订单状态
result.type | inr | String | 货币类型
result.fee | 65 | Integer | 代收费用
result.payUrl | https://pay.tkusdtmanage.com/20240525203241417010001 | String | 收银台地址
result.expireTime | 0 | Integer | 超时时间
time | 2024-05-25 20:32:43 | String | 消息时间
## /代收/代收订单查询
```text
<details>
  <summary>点击查看示例代码！</summary>
 ** C# 示例代码**


using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ApiTest;

internal class Program
{
    private static async Task Main(string[] args)
    {
        // 测试参数
        var apiHost = "https://api.example.com";
        var accessKey = "yourAccessKey";
        var accessSecret = "yourAccessSecret";

        // 测试查询订单
        Console.WriteLine("\n开始测试 QueryOrder 方法...");
        var orderNo = "418745536433411011";
        var queryOrderResult = await QueryOrderAsync(apiHost, accessKey, accessSecret, orderNo);
        Console.WriteLine($"查询订单结果: {queryOrderResult}");

        Console.WriteLine("\n测试完成。按任意键退出...");
        Console.ReadKey();
    }

    public static async Task<string> QueryOrderAsync(string apiHost, string accessKey, string accessSecret, string orderNo)
    {
        // 处理API主机地址并构建URL
        apiHost = apiHost.TrimEnd('/');
        var url = $"{apiHost}/api/order/queryorder";

        // 准备签名相关数据
        var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();
        var nonce = GenerateNonce(6); // 可以根据需要调整长度
        var signature = GenerateSignature("POST", url, timestamp, nonce, accessKey, accessSecret);

        try
        {
            using var client = new HttpClient();

            // 添加请求头
            client.DefaultRequestHeaders.Add("accessKey", accessKey);
            client.DefaultRequestHeaders.Add("timestamp", timestamp.ToString());
            client.DefaultRequestHeaders.Add("nonce", nonce);
            client.DefaultRequestHeaders.Add("sign", signature);

            // 准备请求体并发送请求
            var content = new StringContent(
                JsonSerializer.Serialize(new { orderNo }),
                Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(url, content);

            // 处理响应
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"请求失败: {response.StatusCode}");
                return string.Empty;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"查询订单异常: {ex.Message}");
            return string.Empty;
        }
    }

    // 生成随机字符串作为nonce
    private static string GenerateNonce(int len = 8)
    {
        const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return string.Concat(Enumerable.Range(0, len).Select(_ => chars[Random.Shared.Next(chars.Length)]));
    }

    // 获取URL路径部分
    private static string FormatUrl(string url) => new Uri(url).AbsolutePath;

    // 生成API签名
    private static string GenerateSignature(string method, string url, long timestamp, string nonce, string accessKey, string accessSecret)
    {
        var formattedUrl = FormatUrl(url);
        var signatureData = $"{method.ToUpper()}&{formattedUrl}&{accessKey}&{timestamp}&{nonce}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
    }
}
</details>



## 货币类型

type: ['inr' , 'trx', 'usdt']

inr: 卢比

trx: 波场TRX

usdt:  波场USDT




## 状态枚举
status

    created : 创建,    商户拉单成功后的状态

    paying :  支付中,   真实用户访问收银台后的状态
    
    timeOut : 超时,      订单超时

    success : 成功,       用户支付成功

    fail : 失败,         用户支付失败

    cancel : 取消,       用户取消支付

    exception : 异常,     订单异常
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/order/queryorder

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | tw58ui0z60yYhaCTyROy6g | String | 是 | 用户 accessKey
timestamp | 1716649330 | String | 是 | 10位时间戳
nonce | 1716649330 | String | 是 | 6位随机字符串
sign | i4vUNSVwfKOtFYn5RmH2zuL+KuLedSm5Vot8cCcrXC4= | String | 是 | 签名结果 accessKey 在线工具 https://1024tools.com/hmac
#### 请求Body参数
```javascript
{
    "orderNo": "418745536433411011",
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
orderNo | 418745536433411011 | String | 是 | 平台订单号, 或商户订单号
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"orderno": "20240528150416746010002",
	"merchantorder": "41870855396185911",
	"currency": "inr",
	"amount": 1000,
	"fee": 65,
	"proof": "123456789012",
	"status": "success",
	"payee": "abc@air",
	"bankname": "iob",
	"bankaccount": "123456789",
	"createtime": "2024-05-28 15:04:16",
	"updatetime": "2024-05-28 15:06:28"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
orderno | 20240528150416746010002 | String | 平台订单号
merchantorder | 41870855396185911 | String | 商家订单号
currency | inr | String | 币种
amount | 1000 | Integer | 金额
fee | 65 | Integer | 手续费
proof | 123456789012 | String | 凭证 inr时为UTR,波场为hash
status | success | String | 状态
payee | abc@air | String | 收款人upi
bankname | iob | String | 银行名称
bankaccount | 123456789 | String | 银行卡号
createtime | 2024-05-28 15:04:16 | String | 创建时间
updatetime | 2024-05-28 15:06:28 | String | 更新时间
## /代收/代收回调
```text
<details>
  <summary>点击查看示例代码！</summary>
 ** C# 示例代码**


using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace ApiTest.Controllers
{
    /// <summary>
    /// 通知控制器 - 用于接收支付平台的回调通知
    /// 本示例演示如何接收和处理支付平台发送的订单状态通知
    /// </summary>
    [ApiController]                              // 标记为API控制器
    [Route("api/[controller]")]                  // 设置路由前缀为"api/Notify"
    public class NotifyController : ControllerBase
    {
        // 商户的API访问凭证
        private readonly string _accessKey;      // 访问密钥ID
        private readonly string _accessSecret;   // 访问密钥Secret

        /// <summary>
        /// 控制器构造函数
        /// </summary>
        public NotifyController()
        {
            // 在构造函数中初始化凭证
            // 注意：实际生产环境中应从配置文件、环境变量或密钥管理系统获取这些敏感信息
            _accessKey = "yourAccessKey";        // 替换为您的AccessKey
            _accessSecret = "yourAccessSecret";  // 替换为您的AccessSecret
        }

        /// <summary>
        /// 订单通知接收端点
        /// 支付平台将通过POST请求发送订单状态变更通知到此端点
        /// 端点完整URL为: https://您的域名/api/Notify/orderNotify
        /// </summary>
        /// <param name="jsonBody">通知的JSON数据主体</param>
        /// <returns>处理结果</returns>
        [HttpPost("orderNotify")]   // 设置HTTP POST路由为"orderNotify"
        public async Task<IActionResult> OrderNotify([FromBody] JToken jsonBody)
        {
            try
            {
                // 1. 记录收到的通知内容，便于调试和问题排查
                Console.WriteLine($"收到代收回调通知: {jsonBody.ToString()}");

                // 2. 验证请求头中是否包含所需的签名参数
                // 支付平台的通知请求头中必须包含：accessKey、timestamp、nonce和sign
                if (!Request.Headers.TryGetValue("accessKey", out var accessKeyValues) ||
                    !Request.Headers.TryGetValue("timestamp", out var timestampValues) ||
                    !Request.Headers.TryGetValue("nonce", out var nonceValues) ||
                    !Request.Headers.TryGetValue("sign", out var signValues))
                {
                    Console.WriteLine("请求头缺少必要参数");
                    return "Error Sign";
                }

                // 3. 提取请求头中的签名相关数据
                var requestAccessKey = accessKeyValues.ToString();  // 请求方的AccessKey
                var timestamp = timestampValues.ToString();         // 请求的时间戳
                var nonce = nonceValues.ToString();                 // 随机字符串
                var sign = signValues.ToString();                   // 请求方的签名

                // 4. 验证AccessKey是否匹配
                // 确保通知来自授权的支付平台
                if (requestAccessKey != _accessKey)
                {
                    Console.WriteLine("AccessKey不匹配");
                    return "无效的AccessKey";  //表示AccessKey无效
                }
                // 这里应该对timestamp进行验证, 例如检查是否在允许的时间范围内

                // 5. 验证签名
                // 重要：URL路径必须与实际请求路径完全匹配，包括大小写
                // 此处的"/api/Notify/orderNotify"应与您的实际API路径一致
                var expectedSignature = GenerateSignature("POST", "/api/Notify/orderNotify", timestamp, nonce, _accessKey, _accessSecret);
                if (sign != expectedSignature)
                {
                    Console.WriteLine("签名验证失败");
                    return "Sign Fail";  // 表示签名验证失败
                }

                Console.WriteLine("签名验证通过，处理订单...");

                // 重要：必须返回"success"，告知支付平台通知已成功处理
                // 如果不返回"success"，支付平台会按照一定的时间间隔重复发送通知
                return "success";
            }
            catch (Exception ex)
            {
                // 7. 异常处理
                // 记录详细错误信息，便于问题排查
                Console.WriteLine($"处理回调通知时发生异常: {ex.Message}");
                return "Exception";  // 修改返回类型以符合新的处理逻辑
            }
        }

        // 生成API签名
        // 使用HMAC-SHA256算法，与支付平台的签名算法保持一致
        private string GenerateSignature(string method, string url, string timestamp, string nonce, string accessKey, string accessSecret)
        {
            // 1. 构建签名数据
            // 格式为：HTTP方法&URL路径&AccessKey&时间戳&随机字符串
            var signatureData = $"{method.ToUpper()}&{url}&{accessKey}&{timestamp}&{nonce}";

            // 2. 使用HMAC-SHA256算法和AccessSecret计算签名
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));

            // 3. 对结果进行Base64编码并返回
            return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
        }
    }
}
</details>





## 回调说明
如果成功接收回调后 返回 `success` 字符串, 系统认为回调成功,不在回调
如果非 `success` 系统认为回调失败,会延迟再次发送回调, 共8次 延迟依次间隔 0 2 4 8 ... 分钟

## 货币类型

type: ['inr' , 'trx', 'usdt']

inr: 卢比

trx: 波场TRX

usdt:  波场USDT




## 状态枚举
status

    created : 创建,    商户拉单成功后的状态

    paying :  支付中,   真实用户访问收银台后的状态
    
    timeOut : 超时,      订单超时

    success : 成功,       用户支付成功

    fail : 失败,         用户支付失败

    cancel : 取消,       用户取消支付

    exception : 异常,     订单异常
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/youurl

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | tw58ui0z60yYhaCTyROy6g | String | 是 | 用户 accessKey
timestamp | 1716649330 | String | 是 | 10位时间戳
nonce | 342341 | String | 是 | 6位随机字符串
sign | i4vUNSVwfKOtFYn5RmH2zuL+KuLedSm5Vot8cCcrXC4= | String | 是 | 签名结果 accessKey 在线工具 https://1024tools.com/hmac
#### 请求Body参数
```javascript
{
	"orderno": "20240528150416746010002",
	"merchantorder": "41870855396185911",
	"currency": "inr",
	"amount": 1000,
	"fee": 65,
	"proof": "123456789012",
	"status": "success",
	"createtime": "2024-05-28 15:04:16",
	"updatetime": "2024-05-28 15:06:28"
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
orderno | 20240528150416746010002 | String | 是 | 平台订单号
merchantorder | 41870855396185911 | String | 是 | 商户订单号
currency | inr | String | 是 | 货币名称
amount | 1000 | Integer | 是 | 金额
fee | 65 | Integer | 是 | 代收费
proof | 123456789012 | String | 是 | 凭证 inr时为UTR,波场为hash
status | success | String | 是 | 状态
createtime | 2024-05-28 15:04:16 | String | 是 | 创建时间,
updatetime | 2024-05-28 15:06:28 | String | 是 | 最后更新时间
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
"success"
```
## /代收/补单
```text
<details>
  <summary>点击查看示例代码！</summary>
 ** C# 示例代码**


using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ApiTest;

internal class Program
{
    private static async Task Main(string[] args)
    {
        // 测试参数
        var apiHost = "https://api.example.com";
        var accessKey = "yourAccessKey";
        var accessSecret = "yourAccessSecret";

        // 测试补单
        Console.WriteLine("\n开始测试 MakeupOrder 方法...");
        var utr = "343767445476";
        var orderNo = "20240524182129796010005";
        var makeupResult = await MakeupOrderAsync(apiHost, accessKey, accessSecret, orderNo, utr);
        Console.WriteLine($"补单结果: {makeupResult}");

        Console.WriteLine("\n测试完成。按任意键退出...");
        Console.ReadKey();
    }

    public static async Task<string> MakeupOrderAsync(string apiHost, string accessKey, string accessSecret, string orderNo, string utr)
    {
        // 处理API主机地址并构建URL,确保apiHost后面没有斜杠
        apiHost = apiHost.TrimEnd('/');
        var url = $"{apiHost}/api/order/makeup";

        // 准备签名相关数据
        var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();
        var nonce = GenerateNonce(6); // 可以根据需要调整长度
        var signature = GenerateSignature("POST", url, timestamp, nonce, accessKey, accessSecret);

        try
        {
            using var client = new HttpClient();

            // 添加请求头
            client.DefaultRequestHeaders.Add("accessKey", accessKey);
            client.DefaultRequestHeaders.Add("timestamp", timestamp.ToString());
            client.DefaultRequestHeaders.Add("nonce", nonce);
            client.DefaultRequestHeaders.Add("sign", signature);

            // 准备请求体并发送请求
            var makeupRequest = new MakeupOrderRequest
            {
                OrderNo = orderNo,
                Utr = utr
            };

            var content = new StringContent(
                JsonSerializer.Serialize(makeupRequest),
                Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(url, content);

            // 处理响应
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"请求失败: {response.StatusCode}");
                return string.Empty;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"补单异常: {ex.Message}");
            return string.Empty;
        }
    }

    // 生成随机字符串作为nonce
    private static string GenerateNonce(int len = 8)
    {
        const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return string.Concat(Enumerable.Range(0, len).Select(_ => chars[Random.Shared.Next(chars.Length)]));
    }

    // 获取URL路径部分
    private static string FormatUrl(string url) => new Uri(url).AbsolutePath;

    // 生成API签名
    private static string GenerateSignature(string method, string url, long timestamp, string nonce, string accessKey, string accessSecret)
    {
        var formattedUrl = FormatUrl(url);
        var signatureData = $"{method.ToUpper()}&{formattedUrl}&{accessKey}&{timestamp}&{nonce}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
    }
}

public class MakeupOrderRequest
{
    public string OrderNo { get; set; } = string.Empty;
    public string Utr { get; set; } = string.Empty;
}
</details>
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/order/makeup

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | tw58ui0z60yYhaCTyROy6g | String | 是 | 用户 accessKey
timestamp | 1716555471 | String | 是 | 10位时间戳
nonce | 1716555471 | String | 是 | 6位随机字符串
sign | RXhk3omNdIzx3HJpScP87GJViISG1TUWsd/hSbyJm/8= | String | 是 | 签名结果 accessKey 在线工具 https://1024tools.com/hmac
#### 请求Body参数
```javascript
{
    "OrderNo": "20240524182129796010005",
    "utr": "343767445476",
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
OrderNo | 20240524182129796010005 | String | 是 | 订单号
utr | 343767445476 | String | 是 | utr
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 200,
	"type": "success",
	"message": "",
	"result": "Successful, waiting for callback",
	"time": "2024-05-24 18:28:03"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 200 | Integer | 操作状态 非200 失败
type | success | String | API操作状态
message | - | String | 操作消息
result | Successful, waiting for callback | String | -
time | 2024-05-24 18:28:03 | String | 消息时间
## /代收/查询UPI
```text
<details>
  <summary>点击查看示例代码！</summary>
 ** C# 示例代码**
    
    

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ApiTest;

internal class Program
{
    private static async Task Main(string[] args)
    {
        Console.WriteLine("开始测试 QueryUpi 方法...");

        // 测试参数
        var apiHost = "https://api.example.com";
        var accessKey = "yourAccessKey";
        var accessSecret = "yourAccessSecret";
        var upi = "test.upi@example";

        // 调用查询方法并输出结果
        var result = await QueryUpiAsync(apiHost, accessKey, accessSecret, upi);
        Console.WriteLine($"查询结果: {result}");

        Console.WriteLine("测试完成。按任意键退出...");
        Console.ReadKey();
    }

    public static async Task<string> QueryUpiAsync(string apiHost, string accessKey, string accessSecret, string upi)
    {
        // 处理API主机地址并构建URL
        apiHost = apiHost.TrimEnd('/');
        var url = $"{apiHost}/api/order/queryupi";

        // 准备签名相关数据
        var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();
        var nonce = GenerateNonce();
        var signature = GenerateSignature("POST", url, timestamp, nonce, accessKey, accessSecret);

        try
        {
            using var client = new HttpClient();

            // 添加请求头
            client.DefaultRequestHeaders.Add("accessKey", accessKey);
            client.DefaultRequestHeaders.Add("timestamp", timestamp.ToString());
            client.DefaultRequestHeaders.Add("nonce", nonce);
            client.DefaultRequestHeaders.Add("sign", signature);

            // 准备请求体并发送请求
            var content = new StringContent(
                JsonSerializer.Serialize(new { upi }),
                Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(url, content);

            // 处理响应
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"请求失败: {response.StatusCode}");
                return string.Empty;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"查询UPI异常: {ex.Message}");
            return string.Empty;
        }
    }

    // 生成8位随机字符串作为nonce
    private static string GenerateNonce()
    {
        const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return string.Concat(Enumerable.Range(0, 8).Select(_ => chars[Random.Shared.Next(chars.Length)]));
    }

    // 获取URL路径部分
    private static string FormatUrl(string url) => new Uri(url).AbsolutePath;

    // 生成API签名
    private static string GenerateSignature(string method, string url, long timestamp, string nonce, string accessKey, string accessSecret)
    {
        var formattedUrl = FormatUrl(url);
        var signatureData = $"{method.ToUpper()}&{formattedUrl}&{accessKey}&{timestamp}&{nonce}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
    }
}
</details>
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/order/queryupi

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | tw58ui0z60yYhaCTyROy6g | String | 是 | 用户 accessKey
timestamp | 1716650080 | String | 是 | 10位时间戳
nonce | 1716650080 | String | 是 | 6位随机字符串
sign | zrSuvgWfY7+4tiv0W3ttuGwk3CxvmkR+Q6Mv0SDMI+U= | String | 是 | 签名结果 accessKey 在线工具 https://1024tools.com/hmac
#### 请求Body参数
```javascript
{
    "upi": "mahirverma754@axl",
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
upi | mahirverma754@axl | String | 是 | -
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 200,
	"type": "success",
	"message": "",
	"result": {
		"upi": "mahirverma754@axl",
		"status": "exist"
	},
	"time": "2024-05-25 20:44:53"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 200 | Integer | 操作状态 非200 失败
type | success | String | API操作状态
message | - | String | 操作消息
result | - | Object | -
result.upi | mahirverma754@axl | String | -
result.status | exist | String | 是否存在:  exist 存在,  noexist 不存在,  error 查询失败
time | 2024-05-25 20:44:53 | String | 消息时间
## /代收/查询UTR
```text
<details>
  <summary>点击查看示例代码！</summary>
 ** C# 示例代码**
    
    

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ApiTest;

internal class Program
{
    private static async Task Main(string[] args)
    {
        // 测试参数
        var apiHost = "https://api.example.com";
        var accessKey = "yourAccessKey";
        var accessSecret = "yourAccessSecret";

        // 测试查询UTR
        Console.WriteLine("\n开始测试 QueryUtr 方法...");
        var utr = "343767445476";
        var utrResult = await QueryUtrAsync(apiHost, accessKey, accessSecret, utr);
        Console.WriteLine($"查询UTR结果: {utrResult}");

        Console.WriteLine("\n测试完成。按任意键退出...");
        Console.ReadKey();
    }

    public static async Task<string> QueryUtrAsync(string apiHost, string accessKey, string accessSecret, string utr)
    {
        // 处理API主机地址并构建URL
        apiHost = apiHost.TrimEnd('/');
        var url = $"{apiHost}/api/order/queryutr";

        // 准备签名相关数据
        var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();
        var nonce = GenerateNonce();
        var signature = GenerateSignature("POST", url, timestamp, nonce, accessKey, accessSecret);

        try
        {
            using var client = new HttpClient();

            // 添加请求头
            client.DefaultRequestHeaders.Add("accessKey", accessKey);
            client.DefaultRequestHeaders.Add("timestamp", timestamp.ToString());
            client.DefaultRequestHeaders.Add("nonce", nonce);
            client.DefaultRequestHeaders.Add("sign", signature);

            // 准备请求体并发送请求
            var content = new StringContent(
                JsonSerializer.Serialize(new { utr }),
                Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(url, content);

            // 处理响应
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"请求失败: {response.StatusCode}");
                return string.Empty;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"查询UTR异常: {ex.Message}");
            return string.Empty;
        }
    }

    // 生成8位随机字符串作为nonce
    private static string GenerateNonce(int len = 8)
    {
        const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return string.Concat(Enumerable.Range(0, len).Select(_ => chars[Random.Shared.Next(chars.Length)]));
    }

    // 获取URL路径部分
    private static string FormatUrl(string url) => new Uri(url).AbsolutePath;

    // 生成API签名
    private static string GenerateSignature(string method, string url, long timestamp, string nonce, string accessKey, string accessSecret)
    {
        var formattedUrl = FormatUrl(url);
        var signatureData = $"{method.ToUpper()}&{formattedUrl}&{accessKey}&{timestamp}&{nonce}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
    }
}
</details>





### 状态枚举

    WaitMakeup = 1,   //等待补单

    Makeuped = 2,     //已被领取

    NotExist = 3,     //UTR不存在
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/order/queryutr

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | tw58ui0z60yYhaCTyROy6g | String | 是 | 用户 accessKey
timestamp | 1716650232 | String | 是 | 10位时间戳
nonce | 1716650232 | String | 是 | 6位随机字符串
sign | RO3dkOE9mcR1Pf+kllfMhm4hVZbcgdr3wBK3qq168TU= | String | 是 | 签名结果 accessKey 在线工具 https://1024tools.com/hmac
#### 请求Body参数
```javascript
{
	"utr": "343767445476"
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
utr | 343767445476 | String | 是 | -
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 200,
	"type": "success",
	"message": "",
	"result": {
		"utr": "343767445476",
		"status": "makeuped",
		"orderNo": "20240524182129796010005",
		"message": "UTR completed",
		"amount": 1000
	},
	"time": "2024-05-25 20:47:26"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 200 | Integer | 操作状态 非200 失败
type | success | String | API操作状态
message | - | String | 操作消息
result | - | Object | -
result.utr | 343767445476 | String | utr
result.status | makeuped | String | UTR状态
result.orderNo | 20240524182129796010005 | String | 已经匹配的订单号
result.message | UTR completed | String | 说明
result.amount | 1000 | Integer | 金额,
time | 2024-05-25 20:47:26 | String | 消息时间
## /代付
```text
暂无描述
```
#### Header参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### Query参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### Body参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
## /代付/创建代付
```text
<details>
  <summary>点击查看示例代码！</summary>
 ** C# 示例代码**


using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ApiTest;

internal class Program
{
    private static async Task Main(string[] args)
    {
        // 测试参数
        var apiHost = "https://api.example.com";
        var accessKey = "yourAccessKey";
        var accessSecret = "yourAccessSecret";

        // 测试创建代付订单
        Console.WriteLine("\n开始测试 CreatePayOrder 方法...");
        var payOrderRequest = new PayOrderRequest
        {
            McorderNo = $"PO{DateTimeOffset.Now.ToUnixTimeMilliseconds()}",
            Amount = "500.00",
            Type = "inr",
            ChannelCode = "71001",
            Address = "Txxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // 注意这里只有在USDT,或TRX币种时才需要填写
            Name = "TURBO SERVICES",
            BankName = "SBI",
            BankAccount = "4180002100015798",
            Ifsc = "PUNB0418000",
            NotifyUrl = "http://127.0.0.1/api/notify/transaction"
        };
        var createPayOrderResult = await CreatePayOrderAsync(apiHost, accessKey, accessSecret, payOrderRequest);
        Console.WriteLine($"创建代付订单结果: {createPayOrderResult}");

        Console.WriteLine("\n测试完成。按任意键退出...");
        Console.ReadKey();
    }

    public static async Task<string> CreatePayOrderAsync(string apiHost, string accessKey, string accessSecret, PayOrderRequest payOrderRequest)
    {
        // 处理API主机地址并构建URL
        apiHost = apiHost.TrimEnd('/');
        var url = $"{apiHost}/api/payorder/create";

        // 准备签名相关数据
        var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();
        var nonce = GenerateNonce(6); //可以根据需要调整长度
        var signature = GenerateSignature("POST", url, timestamp, nonce, accessKey, accessSecret);

        try
        {
            using var client = new HttpClient();

            // 添加请求头
            client.DefaultRequestHeaders.Add("accessKey", accessKey);
            client.DefaultRequestHeaders.Add("timestamp", timestamp.ToString());
            client.DefaultRequestHeaders.Add("nonce", nonce);
            client.DefaultRequestHeaders.Add("sign", signature);

            // 准备请求体并发送请求
            var content = new StringContent(
                JsonSerializer.Serialize(payOrderRequest),
                Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(url, content);

            // 处理响应
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"请求失败: {response.StatusCode}");
                return string.Empty;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"创建代付订单异常: {ex.Message}");
            return string.Empty;
        }
    }

    // 生成随机字符串作为nonce
    private static string GenerateNonce(int len = 8)
    {
        const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return string.Concat(Enumerable.Range(0, len).Select(_ => chars[Random.Shared.Next(chars.Length)]));
    }

    // 获取URL路径部分
    private static string FormatUrl(string url) => new Uri(url).AbsolutePath;

    // 生成API签名
    private static string GenerateSignature(string method, string url, long timestamp, string nonce, string accessKey, string accessSecret)
    {
        var formattedUrl = FormatUrl(url);
        var signatureData = $"{method.ToUpper()}&{formattedUrl}&{accessKey}&{timestamp}&{nonce}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
    }
}

public class PayOrderRequest
{
    public string McorderNo { get; set; } = string.Empty;
    public string Amount { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ChannelCode { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string BankAccount { get; set; } = string.Empty;
    public string Ifsc { get; set; } = string.Empty;
    public string NotifyUrl { get; set; } = string.Empty;
}
</details>



## 货币类型

type: ['inr' , 'trx', 'usdt']

inr: 卢比

trx: 波场TRX

usdt:  波场USDT


## 状态说明 

status : 

    created : 创建,
    
    waiting : 等待处理,

    paying :  支付中,
    
    success : 成功,

    fail : 失败,

    overrule : 驳回,
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/payorder/create

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | tw58ui0z60yYhaCTyROy6g | String | 是 | 用户 accessKey
timestamp | 1716649930 | String | 是 | 10位时间戳
nonce | 1716649930 | String | 是 | 6位随机字符串
sign | lcgPEvtOFNUJzhXapyMxzrOz2KrKJPrKOrnWhbemnzs= | String | 是 | 签名结果 accessKey 在线工具 https://1024tools.com/hmac
#### 请求Body参数
```javascript
{
    "McorderNo": "874381985331514817",
    "Amount": "500",
    "Type": "inr",
    "ChannelCode": "71001",
    "Address": "TJ1aCzwh29PuxUMjQHoDj6hWg6xuY3odQC",
    "name": "TURBO SERVICES, TURBO SERVICES",
    "BankName": "SBI",
    "BankAccount": "4180002100015798",
    "Ifsc": "PUNB0418000",
    "NotifyUrl": "http://127.0.0.1:5005/api/notify/transaction"
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
McorderNo | 87438198533514817 | String | 是 | 商户订单号, 不允许重复
Amount | 500 | String | 是 | 转账金额, 最大两位小数,大于两位自动截断
Type | inr | String | 是 | 货币类型
ChannelCode | 71001 | String | 是 | 您绑定的通道代码
Address | TJ1aCzwh29PuxUMjQHoDj6hWg6xuY3odQC | String | 是 | 在trx,或usdt代付时生效
name | TURBO SERVICES, TURBO SERVICES | String | 是 | 收款人姓名(inr生效)
BankName | SBI | String | 是 | 银行名称(inr生效)
BankAccount | 4180002100015798 | String | 是 | 银行卡号(inr生效)
Ifsc | PUNB0418000 | String | 是 | IFSC(inr生效)
NotifyUrl | http://127.0.0.1:5005/api/notify/transaction | String | 是 | 代付订单通知地址
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 200,
	"type": "success",
	"message": "",
	"result": {
		"orderNo": "20240525204230488010002",
		"merchantOrder": "874381985331514817",
		"amount": 500,
		"status": "created",
		"currency": "inr",
		"fee": 21
	},
	"time": "2024-05-25 20:42:32"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 200 | Integer | 操作状态 非200 失败
type | success | String | API操作状态
message | - | String | 操作消息
result | - | Object | -
result.orderNo | 20240525204230488010002 | String | 返回订单号
result.merchantOrder | 874381985331514817 | String | 商家订单号
result.amount | 500 | Integer | 金额,
result.status | created | String | 订单状态, (查询状说明)
result.currency | inr | String | 货币类型
result.fee | 21 | Integer | 代收费用
time | 2024-05-25 20:42:32 | String | 消息时间
## /代付/代付通知
```text
<details>
  <summary>点击查看示例代码！</summary>
 ** C# 示例代码**


using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

namespace ApiTest.Controllers
{
    /// <summary>
    /// 通知控制器 - 用于接收支付平台的回调通知
    /// 本示例演示如何接收和处理支付平台发送的代付订单状态通知
    /// </summary>
    [ApiController]                              // 标记为API控制器
    [Route("api/[controller]")]                  // 设置路由前缀为"api/Notify"
    public class NotifyController : ControllerBase
    {
        // 商户的API访问凭证
        private readonly string _accessKey;      // 访问密钥ID

        private readonly string _accessSecret;   // 访问密钥Secret

        /// <summary>
        /// 控制器构造函数
        /// </summary>
        public NotifyController()
        {
            // 在构造函数中初始化凭证
            // 注意：实际生产环境中应从配置文件、环境变量或密钥管理系统获取这些敏感信息
            _accessKey = "yourAccessKey";        // 替换为您的AccessKey
            _accessSecret = "yourAccessSecret";  // 替换为您的AccessSecret
        }

        /// <summary>
        /// 代付订单通知接收端点
        /// 支付平台将通过POST请求发送代付订单状态变更通知到此端点
        /// 端点完整URL为: https://您的域名/api/Notify/payOrderNotify
        /// </summary>
        /// <param name="jsonBody">通知的JSON数据主体</param>
        /// <returns>处理结果</returns>
        [HttpPost("payOrderNotify")]   // 设置HTTP POST路由为"payOrderNotify"
        public async Task<ContentResult> PayOrderNotify([FromBody] JToken jsonBody)
        {
            try
            {
                // 1. 记录收到的通知内容，便于调试和问题排查
                Console.WriteLine($"收到代付回调通知: {jsonBody.ToString()}");

                // 2. 验证请求头中是否包含所需的签名参数
                // 支付平台的通知请求头中必须包含：accessKey、timestamp、nonce和sign
                if (!Request.Headers.TryGetValue("accessKey", out var accessKeyValues) ||
                    !Request.Headers.TryGetValue("timestamp", out var timestampValues) ||
                    !Request.Headers.TryGetValue("nonce", out var nonceValues) ||
                    !Request.Headers.TryGetValue("sign", out var signValues))
                {
                    Console.WriteLine("请求头缺少必要参数");
                    return Content("Error Sign");
                }

                // 3. 提取请求头中的签名相关数据
                var requestAccessKey = accessKeyValues.ToString();  // 请求方的AccessKey
                var timestamp = timestampValues.ToString();         // 请求的时间戳
                var nonce = nonceValues.ToString();                 // 随机字符串
                var sign = signValues.ToString();                   // 请求方的签名

                // 4. 验证AccessKey是否匹配
                // 确保通知来自授权的支付平台
                if (requestAccessKey != _accessKey)
                {
                    Console.WriteLine("AccessKey不匹配");
                    return "无效的AccessKey";  // 表示AccessKey无效
                }
                // 这里应该对timestamp进行验证, 例如检查是否在允许的时间范围内

                // 5. 验证签名
                // 重要：URL路径必须与实际请求路径完全匹配，包括大小写
                // 此处的"/api/Notify/payOrderNotify"应与您的实际API路径一致
                var expectedSignature = GenerateSignature("POST", "/api/Notify/payOrderNotify", timestamp, nonce, _accessKey, _accessSecret);
                if (sign != expectedSignature)
                {
                    Console.WriteLine("签名验证失败");
                    return "Sign Fail";  // 表示签名验证失败
                }

                Console.WriteLine("签名验证通过，处理订单...");

                // 7. 代付订单处理逻辑
                // 这里可以添加解析订单数据和状态的代码，例如：
                // string orderNo = jsonBody["orderno"]?.ToString();
                // string merchantOrder = jsonBody["merchantorder"]?.ToString();
                // string status = jsonBody["status"]?.ToString();
                // 然后根据订单状态执行相应的业务处理

                // 重要：必须返回"success"，告知支付平台通知已成功处理
                // 如果不返回"success"，支付平台会按照一定的时间间隔重复发送通知（0、2、4、8...分钟，共8次）
                return "success";
            }
            catch (Exception ex)
            {
                // 8. 异常处理
                // 记录详细错误信息，便于问题排查
                Console.WriteLine($"处理代付回调通知时发生异常: {ex.Message}");
                return "Exception";  // 返回异常信息
            }
        }

        /// <summary>
        /// 生成API签名
        /// 使用HMAC-SHA256算法，与支付平台的签名算法保持一致
        /// </summary>
        /// <param name="method">HTTP方法（GET/POST等，大写）</param>
        /// <param name="url">请求路径（不含域名，如/api/Notify/payOrderNotify）</param>
        /// <param name="timestamp">时间戳（10位Unix时间戳）</param>
        /// <param name="nonce">随机字符串（防止重放攻击）</param>
        /// <param name="accessKey">访问密钥ID</param>
        /// <param name="accessSecret">访问密钥Secret</param>
        /// <returns>Base64编码的签名结果</returns>
        private string GenerateSignature(string method, string url, string timestamp, string nonce, string accessKey, string accessSecret)
        {
            // 1. 构建签名数据
            // 格式为：HTTP方法&URL路径&AccessKey&时间戳&随机字符串
            var signatureData = $"{method.ToUpper()}&{url}&{accessKey}&{timestamp}&{nonce}";

            // 2. 使用HMAC-SHA256算法和AccessSecret计算签名
            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));

            // 3. 对结果进行Base64编码并返回
            return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
        }
    }
}
</details>



## 通知说明
如果成功接收通知后 返回 `success` 字符串, 系统认为通知成功,不在重复通知
如果非 `success` 系统认为通知失败,会延迟再次发送通知, 共8次 延迟依次间隔 0 2 4 8 ... 分钟

## 货币类型

type: ['inr' , 'trx', 'usdt']

inr: 卢比

trx: 波场TRX

usdt:  波场USDT



## 状态
status : 

    created : 创建,
    
    waiting : 等待处理,

    paying :  支付中,
    
    success : 成功,

    fail : 失败,

    overrule : 驳回,
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/youurl

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | tw58ui0z60yYhaCTyROy6g | String | 是 | -
timestamp | 1716649930 | String | 是 | -
nonce | 12311 | String | 是 | -
sign | lcgPEvtOFNUJzhXapyMxzrOz2KrKJPrKOrnWhbemnzs= | String | 是 | -
#### 请求Body参数
```javascript
{
	"orderno": "20240528175929519010002",
	"merchantorder": "8743819853311514817",
	"currency": "inr",
	"amount": 500,
	"fee": 21,
	"proof": "123456789012",
	"status": "fail",
	"createtime": "2024-05-28 17:59:29",
	"updatetime": "2024-05-28 18:04:18"
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
orderno | 20240528175929519010002 | String | 是 | 平台订单号
merchantorder | 8743819853311514817 | String | 是 | 商户订单号
currency | inr | String | 是 | 货币名称
amount | 500 | Integer | 是 | 金额
fee | 21 | Integer | 是 | 代收费
proof | 123456789012 | String | 是 | 凭证 inr时为UTR,波场为hash
status | fail | String | 是 | 状态
createtime | 2024-05-28 17:59:29 | String | 是 | 创建时间,
updatetime | 2024-05-28 18:04:18 | String | 是 | 最后更新时间
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
"success"
```
## /代付/代付订单查询
```text
<details>
  <summary>点击查看示例代码！</summary>
 ** C# 示例代码**


using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ApiTest;

internal class Program
{
    private static async Task Main(string[] args)
    {
        // 测试参数
        var apiHost = "https://api.example.com";
        var accessKey = "yourAccessKey";
        var accessSecret = "yourAccessSecret";

        // 测试查询代付订单
        Console.WriteLine("\n开始测试 QueryPayOrder 方法...");
        var payOrderNo = "874381985331514817";
        var queryPayOrderResult = await QueryPayOrderAsync(apiHost, accessKey, accessSecret, payOrderNo);
        Console.WriteLine($"查询代付订单结果: {queryPayOrderResult}");

        Console.WriteLine("\n测试完成。按任意键退出...");
        Console.ReadKey();
    }

    public static async Task<string> QueryPayOrderAsync(string apiHost, string accessKey, string accessSecret, string orderNo)
    {
        // 处理API主机地址并构建URL
        apiHost = apiHost.TrimEnd('/');
        var url = $"{apiHost}/api/payorder/queryorder";

        // 准备签名相关数据
        var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();
        var nonce = GenerateNonce(6); // 可以根据需要调整随机字符串长度
        var signature = GenerateSignature("POST", url, timestamp, nonce, accessKey, accessSecret);

        try
        {
            using var client = new HttpClient();

            // 添加请求头
            client.DefaultRequestHeaders.Add("accessKey", accessKey);
            client.DefaultRequestHeaders.Add("timestamp", timestamp.ToString());
            client.DefaultRequestHeaders.Add("nonce", nonce);
            client.DefaultRequestHeaders.Add("sign", signature);

            // 准备请求体并发送请求
            var content = new StringContent(
                JsonSerializer.Serialize(new { orderNo }),
                Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(url, content);

            // 处理响应
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"请求失败: {response.StatusCode}");
                return string.Empty;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"查询代付订单异常: {ex.Message}");
            return string.Empty;
        }
    }

    // 生成随机字符串作为nonce
    private static string GenerateNonce(int len = 8)
    {
        const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return string.Concat(Enumerable.Range(0, len).Select(_ => chars[Random.Shared.Next(chars.Length)]));
    }

    // 获取URL路径部分
    private static string FormatUrl(string url) => new Uri(url).AbsolutePath;

    // 生成API签名
    private static string GenerateSignature(string method, string url, long timestamp, string nonce, string accessKey, string accessSecret)
    {
        var formattedUrl = FormatUrl(url);
        var signatureData = $"{method.ToUpper()}&{formattedUrl}&{accessKey}&{timestamp}&{nonce}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
    }
}
</details>







## 货币类型

type: ['inr' , 'trx', 'usdt']

inr: 卢比

trx: 波场TRX

usdt:  波场USDT



## 状态
status : 

    created : 创建,
    
    waiting : 等待处理,

    paying :  支付中,
    
    success : 成功,

    fail : 失败,

    overrule : 驳回,
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/payorder/queryorder

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Header参数
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
accessKey | tw58ui0z60yYhaCTyROy6g | String | 是 | 用户 accessKey
timestamp | 1716649930 | String | 是 | 10位时间戳
nonce | 1716649930 | String | 是 | 6位随机字符串
sign | lcgPEvtOFNUJzhXapyMxzrOz2KrKJPrKOrnWhbemnzs= | String | 是 | 签名结果 accessKey 在线工具 https://1024tools.com/hmac
#### 请求Body参数
```javascript
{
    "orderNo": "874381985331514817",
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
orderNo | 874381985331514817 | String | 是 | 平台订单号, 或商户订单号
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"orderno": "20240528175929519010002",
	"merchantorder": "8743819853311514817",
	"currency": "inr",
	"amount": 500,
	"proof": "123456789012",
	"fee": 21,
	"status": "fail",
	"createtime": "2024-05-28 17:59:29",
	"updatetime": "2024-05-28 18:04:18"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
orderno | 20240528175929519010002 | String | 平台订单号
merchantorder | 8743819853311514817 | String | 商家订单号
currency | inr | String | 币种
amount | 500 | Integer | 金额
proof | - | String | 凭证 inr时为UTR,波场为hash
fee | 21 | Integer | 手续费
status | fail | String | 状态
createtime | 2024-05-28 17:59:29 | String | 创建时间
updatetime | 2024-05-28 18:04:18 | String | 更新时间
## /收银台API
```text
暂无描述
```
#### Header参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### Query参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### Body参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
## /收银台API/首次查询订单
```text
暂无描述
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/order/query

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Body参数
```javascript
{
    "OrderNo": "20240812120623960010003",
    "PayerId": "uff33f231"
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
OrderNo | 20240525200357163010002 | String | 是 | 订单号
PayerId | uff33f231 | String | 是 | 收款人ID
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 200,
	"type": "success",
	"message": "",
	"result": {
		"orderNo": "20240525200357163010002",
		"amount": 1000,
		"cashierInfo": {
			"qr": "upi://pay?pa=mahirverma754@axl&pn=Payment for Ashish Verma&am=1000.00&cu=INR&tid=2024052520041091866646&tn=slPD7NM8",
			"copy": "mahirverma754@axl"
		},
		"status": "timeout",
		"type": "inr",
		"upstreamPayUrl": "",
		"expireTime": 0,
		"jumpUrl": "http://127.0.0.1:5005/api/notify/transaction"
	},
	"time": "2024-05-25 20:56:53"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 200 | Integer | 操作状态 非200 失败
type | success | String | API操作状态
message | - | String | 操作消息
result | - | Object | -
result.orderNo | 20240525200357163010002 | String | 订单号
result.amount | 1000 | Integer | 金额,
result.cashierInfo | - | Object | -
result.cashierInfo.qr | upi://pay?pa=mahirverma754@axl&pn=Payment for Ashish Verma&am=1000.00&cu=INR&tid=2024052520041091866646&tn=slPD7NM8 | String | -
result.cashierInfo.copy | mahirverma754@axl | String | -
result.status | timeout | String | -
result.type | inr | String | -
result.upstreamPayUrl | - | String | -
result.expireTime | 0 | Integer | 超时时间(秒)
result.jumpUrl | http://127.0.0.1:5005/api/notify/transaction | String | -
time | 2024-05-25 20:56:53 | String | 消息时间
## /收银台API/订单轮询
```text
暂无描述
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/order/QueryDetail

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Body参数
```javascript
{
    "OrderNo": "20240525200357163010002",
    "PayerId": "uff33f231"
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
OrderNo | 20240525200357163010002 | String | 是 | 订单号
PayerId | uff33f231 | String | 是 | 收款人ID
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 200,
	"type": "success",
	"message": "",
	"result": {
		"orderNo": "30cbfe0d3e4440878f5800c2558cf2b7",
		"formAddress": "TU7ukKGPBSyxEDtzNXfCfdwhfrZdar1GSU",
		"toAddress": "TYtgtKBQ2LqFJFUhEm2vqUZoVgEHA19Qbq",
		"amount": 1.2,
		"type": "usdt",
		"status": "pending",
		"createTime": "2023-11-26 13:44:44"
	},
	"time": "2023-11-26 13:44:44"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 200 | Integer | 操作状态 非200 失败
type | success | String | API操作状态
message | - | String | 操作消息
result | - | Object | -
result.orderNo | 30cbfe0d3e4440878f5800c2558cf2b7 | String | 返回订单号
result.formAddress | TU7ukKGPBSyxEDtzNXfCfdwhfrZdar1GSU | String | 转出地址
result.toAddress | TYtgtKBQ2LqFJFUhEm2vqUZoVgEHA19Qbq | String | 收款地址
result.amount | 1.2 | Number | 转账金额,
result.type | usdt | String | 货币类型, (查询类型码)
result.status | pending | String | 订单状态, (查询状态码)
result.createTime | 2023-11-26 13:44:44 | String | 创建时间
time | 2023-11-26 13:44:44 | String | 消息时间
## /收银台API/提交UTR
```text
暂无描述
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/order/submitproof

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Body参数
```javascript
{
    "orderNo": "20240525210448500010001",
    "proof": "873336522112",
    "PayerId": "1211122"
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
OrderNo | 20240525200357163010002 | String | 是 | 订单号
PayerId | uff33f231 | String | 是 | 收款人ID
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 400,
	"type": "error",
	"message": "Payment is pending. Please wait.",
	"time": "2024-05-25 21:05:14"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 400 | Integer | 提交凭证并确认成功,返回200 其它返回400
type | error | String | API操作状态
message | Payment is pending. Please wait. | String | 操作消息
time | 2024-05-25 21:05:14 | String | 消息时间
## /收银台API/取消支付
```text
暂无描述
```
#### 接口状态
> 已完成

#### 接口URL
> http://localhost:5005/api/order/Cancel

#### 请求方式
> POST

#### Content-Type
> json

#### 请求Body参数
```javascript
{
    "orderNo": "20240525210448500010001",
    "PayerId": "1211122"
}
```
参数名 | 示例值 | 参数类型 | 是否必填 | 参数描述
--- | --- | --- | --- | ---
OrderNo | 20240525200357163010002 | String | 是 | 订单号
PayerId | uff33f231 | String | 是 | 收款人ID
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
#### 成功响应示例
```javascript
{
	"code": 400,
	"type": "error",
	"message": "Payment is pending. Please wait.",
	"time": "2024-05-25 21:05:14"
}
```
参数名 | 示例值 | 参数类型 | 参数描述
--- | --- | --- | ---
code | 400 | Integer | 成功,返回200 其它返回400
type | error | String | API操作状态
message | Payment is pending. Please wait. | String | 操作消息
time | 2024-05-25 21:05:14 | String | 消息时间
## /示例
```text
暂无描述
```
#### Header参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### Query参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### Body参数
参数名 | 示例值 | 参数描述
--- | --- | ---
暂无参数
#### 认证方式
```text
noauth
```
#### 预执行脚本
```javascript
暂无预执行脚本
```
#### 后执行脚本
```javascript
暂无后执行脚本
```
## /示例/商户余额查询
```text
## 测试KEY
accessKey:  tw58ui0z60yYhaCTyROy6g

accessSecret: IwoScoHCG0C6cUf3N5qDJg


## API地址
https://api.tkusdtapi.com

是模拟地址,请替换正式站的地址


## 请求部分示例
完整请求URL :   https://api.tkusdtapi.com/api/merchant/Balance

方式:  GET

#### 协议头: 
 
accessKey: tw58ui0z60yYhaCTyROy6g
timestamp: 1722165968
nonce: 873492
sign: kM/VrN8JcBixtSQxdSo8YE6j8eH+iUArdoU423wFFUI=
 

#### 签名字符串
GET&/api/merchant/Balance&tw58ui0z60yYhaCTyROy6g&1722165968&873492
**注意:   timestamp要求 10位,精确到秒**

**nonce: 并非强制要求6位数字,也可以包含字母**

签名拼接原则:

请求方法 & 接口路径 & accessKey & 10位当前时间戳 & 随机值

`method & url & accessKey & timestamp & nonce`


#### 签名结果

kM/VrN8JcBixtSQxdSo8YE6j8eH+iUArdoU423wFFUI=



请求示例图:

![image.png](https://img.cdn.apipost.cn/client/user/1324143/avatar/78805a221a988e79ef3f42d7c5bfd41866a62b74ccce2.png "image.png")



#### 返回结果

{
	"code": 200,
	"type": "success",
	"message": "",
	"result": [
		{
			"currency": "inr",
			"balance": 100000
		}
	],
	"time": "2024-07-28 16:58:29"
}

**C# 代码示例**

using System.Security.Cryptography;
using System.Text;

namespace ApiTest;

internal class Program
{
    private static async Task Main(string[] args)
    {
        // 测试参数
        var apiHost = "https://api.example.com";
        var accessKey = "yourAccessKey";
        var accessSecret = "yourAccessSecret";

        // 测试查询余额
        Console.WriteLine("\n开始测试 QueryBalance 方法...");
        var balanceResult = await QueryBalanceAsync(apiHost, accessKey, accessSecret);
        Console.WriteLine($"查询余额结果: {balanceResult}");

        Console.WriteLine("\n测试完成。按任意键退出...");
        Console.ReadKey();
    }

    public static async Task<string> QueryBalanceAsync(string apiHost, string accessKey, string accessSecret)
    {
        // 处理API主机地址并构建URL
        apiHost = apiHost.TrimEnd('/');
        var url = $"{apiHost}/api/merchant/Balance";

        // 准备签名相关数据
        var timestamp = DateTimeOffset.Now.ToUnixTimeSeconds();
        var nonce = GenerateNonce(6); // 文档中提到使用6位随机字符串
        var signature = GenerateSignature("GET", url, timestamp, nonce, accessKey, accessSecret);

        try
        {
            using var client = new HttpClient();

            // 添加请求头
            client.DefaultRequestHeaders.Add("accessKey", accessKey);
            client.DefaultRequestHeaders.Add("timestamp", timestamp.ToString());
            client.DefaultRequestHeaders.Add("nonce", nonce);
            client.DefaultRequestHeaders.Add("sign", signature);

            // 发送GET请求
            var response = await client.GetAsync(url);

            // 处理响应
            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"请求失败: {response.StatusCode}");
                return string.Empty;
            }

            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"查询余额异常: {ex.Message}");
            return string.Empty;
        }
    }

    // 生成随机字符串作为nonce
    private static string GenerateNonce(int len = 8)
    {
        const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return string.Concat(Enumerable.Range(0, len).Select(_ => chars[Random.Shared.Next(chars.Length)]));
    }

    // 获取URL路径部分
    private static string FormatUrl(string url) => new Uri(url).AbsolutePath;

    // 生成API签名
    private static string GenerateSignature(string method, string url, long timestamp, string nonce, string accessKey, string accessSecret)
    {
        var formattedUrl = FormatUrl(url);
        var signatureData = $"{method.ToUpper()}&{formattedUrl}&{accessKey}&{timestamp}&{nonce}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(accessSecret));
        return Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureData)));
    }
}

```