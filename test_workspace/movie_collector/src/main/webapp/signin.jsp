<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<%@ include file="nav_bar.jsp"%>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>회원가입</title>
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

input[type="text"], input[type="password"], input[type="email"] {
	width: 100%;
	padding: 10px;
	margin-bottom: 15px;
	border: 1px solid #ccc;
	border-radius: 4px;
}
/* //버튼 */
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
		<h2>회원가입</h2>

		<%
		if (request.getParameter("error") != null) {
		%>
		<div class="error">회원가입 중 오류가 발생했습니다. 다시 시도해주세요.</div>
		<%
		}
		%>

		<form action="SignServlet.do" method="post">
			<input type="text" name="id" placeholder="아이디" required>
			<input type="password" name="password" placeholder="비밀번호" required>
			<input type="email" name="email" placeholder="이메일">
			<input type="text" name="nickname" placeholder="닉네임">
			<input type="submit" value="회원가입">
			<input type="reset" value="다시작성">
			<button type="button" onclick="location.href='login.jsp'">로그인</button>
		</form>
	</div>

</body>
</html>