<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ include file="nav_bar.jsp"%>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>로그인</title>
<link rel="stylesheet" href="./bootstrap-3.3.7-dist/css/bootstrap.min.css" />
<style>
body {
	font-family: 'Arial', sans-serif;
	background-color: #f7f7f7;
}

#container {
	width: 40%;
	margin: 60px auto;
	background-color: #ffffff;
	padding: 30px;
	border: 1px solid #cccccc;
	border-radius: 8px;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

input[type="text"], input[type="password"] {
	width: 100%;
	padding: 10px;
	margin-bottom: 15px;
	border: 1px solid #ccc;
	border-radius: 4px;
}

input[type="submit"], input[type="reset"], button {
	padding: 10px 20px;
	margin-right: 10px;
	border: none;
	border-radius: 4px;
	background-color: #007bff;
	color: #fff;
	font-size: 16px;
	cursor: pointer;
}

input[type="submit"]:hover, input[type="reset"]:hover, button:hover {
	background-color: #0056b3;
}

h2 {
	text-align: center;
	color: #333;
	margin-bottom: 30px;
}

.error {
	color: red;
	text-align: center;
	margin-bottom: 15px;
}
</style>
</head>
<body>
	<div id="container">
		<h2>로그인</h2>

		<%
		if (request.getParameter("error") != null) {
		%>
		<div class="error">로그인 실패. 아이디 또는 비밀번호를 확인하세요.</div>
		<%
		}
		%>

		<form action="LoginServlet.do" method="post">
			<input type="text" name="id" placeholder="아이디" required>
			<input type="password" name="password" placeholder="비밀번호" required>
			<input type="submit" value="로그인">
			<input type="reset" value="다시작성">
			<button type="button" onclick="location.href='signin.jsp'">회원가입</button>
		</form>
	</div>
</body>
</html>