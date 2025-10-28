<%@ page language="java" contentType="text/html; charset=UTF-8"
	pageEncoding="UTF-8"%>
<%@ taglib uri="http://java.sun.com/jsp/jstl/core" prefix="c"%>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title></title>
<style>
nav {
	background: #eee;
	padding: 10px 20px;
	display: flex;
	align-items: center;
	justify-content: space-between;
}

/* 왼쪽, 가운데, 오른쪽 각각 영역 */
.nav-left, .nav-center, .nav-right {
	flex: 1; /* 세 영역 균등 배분 */
	display: flex;
	align-items: center;
}

.nav-center {
	justify-content: center; /* 로고 중앙 정렬 */
}

.nav-right {
	justify-content: flex-end; /* 메뉴 오른쪽 정렬 */
	gap: 15px;
}

nav a {
	text-decoration: none;
	font-weight: bold;
	color: black;
}
</style>
</head>
<body>
	<nav>
		<div class="nav-left"></div>
		<div class="nav-center">
			<a href="index.jsp" class="float-center"><img src="logo.png"
				width="40" height="40"></a>

		</div>
		<div class="nav-right">
			<c:choose>
				<c:when test="${empty sessionScope.userId}">
					<a href="signin.jsp" class="float-right">회원가입 </a>
				</c:when>
				<c:otherwise>
					<a href="mypage.jsp" class="float-right"> 마이페이지</a>
				</c:otherwise>
			</c:choose>

			<c:choose>
				<c:when test="${empty sessionScope.userId}">
					<a href="login.jsp" class="float-right">로그인</a>
				</c:when>
				<c:otherwise>
					<a href="logout.jsp">로그아웃 (${sessionScope.userId })</a>
				</c:otherwise>
			</c:choose>
		</div>


	</nav>
</body>
</html>